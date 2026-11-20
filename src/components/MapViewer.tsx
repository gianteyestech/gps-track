import React, { useRef, useEffect, useMemo } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { Device, Position } from '../types/traccar';
import { getDeviceOperationalStatus, getStatusColor, formatSpeed } from '../utils/formatters';

interface MapViewerProps {
  devices: Device[];
  positions: Record<number, Position>;
  selectedDeviceId?: number | null;
  onSelectDevice?: (deviceId: number) => void;
  routeCoordinates?: { latitude: number; longitude: number; speed?: number; time?: string }[];
  playbackPosition?: { latitude: number; longitude: number; course?: number };
  mapLayer?: 'osm' | 'satellite' | 'dark';
  autoFit?: boolean;
  forceRecenter?: number;
}

const CustomWebView = WebView as any;

// Static Leaflet HTML template — NEVER changes across renders so the iframe/WebView is never reloaded!
const LEAFLET_STATIC_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body, html, #map {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #E5E7EB;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    .custom-marker {
      background: none;
      border: none;
    }
    /* Smooth CSS transition for marker translation so vehicles glide between GPS fixes */
    .leaflet-marker-icon {
      transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1);
      will-change: transform;
    }
    .marker-pin {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.35);
      position: relative;
      cursor: pointer;
      transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease;
    }
    .marker-pin.selected {
      border: 3.5px solid #2563EB !important;
      transform: scale(1.15);
      box-shadow: 0 0 16px rgba(37,99,235,0.7) !important;
    }
    .marker-rotator {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.35s ease;
    }
    .marker-arrow {
      width: 0;
      height: 0;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      position: absolute;
      top: 3px;
    }
    .marker-label {
      position: absolute;
      bottom: -22px;
      white-space: nowrap;
      font-size: 11px;
      font-weight: 800;
      color: #1F2937;
      background: rgba(255,255,255,0.95);
      padding: 2px 7px;
      border-radius: 6px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.25);
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      zoomControl: true,
      attributionControl: false
    }).setView([31.5204, 74.3587], 12);

    var currentTileLayer = null;
    var currentLayerType = null;
    function setLayer(layerType) {
      if (currentLayerType === layerType && currentTileLayer) return;
      currentLayerType = layerType;
      if (currentTileLayer) map.removeLayer(currentTileLayer);

      if (layerType === 'satellite') {
        currentTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });
      } else if (layerType === 'dark') {
        currentTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd' });
      } else {
        // High performance Google Maps layer with live traffic
        currentTileLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}', {
          maxZoom: 20,
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
        });
      }
      currentTileLayer.addTo(map);
    }
    setLayer('osm');

    var markersMap = {};
    var markersMeta = {};
    var routePolyline = null;
    var playbackMarker = null;
    var mapInitialized = false;
    var lastSelectedId = null;
    var userIsInteracting = false;

    // Track user drag / zoom so we do not interrupt manual inspection
    map.on('movestart dragstart zoomstart', function() {
      userIsInteracting = true;
    });
    map.on('moveend dragend zoomend', function() {
      setTimeout(function() {
        userIsInteracting = false;
      }, 3000);
    });

    function createMarkerHtml(m) {
      var isSel = m.isSelected ? 'selected' : '';
      var borderStyle = m.isSelected
        ? ''
        : 'border: 2.5px solid ' + m.color + ';';

      return '<div class="marker-pin ' + isSel + '" style="' + borderStyle + '">' +
        '<div class="marker-rotator" style="transform: rotate(' + (m.course || 0) + 'deg);">' +
          '<div class="marker-arrow" style="border-bottom: 12px solid ' + m.color + ';"></div>' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="' + m.color + '" style="margin-top: 5px;">' +
            '<path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>' +
          '</svg>' +
        '</div>' +
        '<div class="marker-label">' + m.name + '</div>' +
      '</div>';
    }

    function emitSelect(deviceId) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_DEVICE', deviceId: deviceId }));
      } else if (window.parent) {
        window.parent.postMessage({ type: 'SELECT_DEVICE', deviceId: deviceId }, '*');
      }
    }

    window.updateData = function(data) {
      if (!data) return;

      // 1. Map Layer
      if (data.layer) setLayer(data.layer);

      // 2. Markers update
      if (data.markers && data.markers.length > 0) {
        var bounds = [];
        var activeIds = {};

        data.markers.forEach(function(m) {
          activeIds[m.id] = true;
          var latlng = [m.lat, m.lng];
          bounds.push(latlng);

          var existing = markersMap[m.id];
          var meta = markersMeta[m.id];

          if (existing) {
            // ONLY move coordinates — CSS transition will glide the vehicle smoothly!
            existing.setLatLng(latlng);

            // If rotation, color, selection changed, update icon
            if (!meta || meta.course !== m.course || meta.isSelected !== m.isSelected || meta.color !== m.color || meta.name !== m.name) {
              existing.setIcon(L.divIcon({
                className: 'custom-marker',
                html: createMarkerHtml(m),
                iconSize: [40, 40],
                iconAnchor: [20, 20],
                popupAnchor: [0, -24]
              }));
              markersMeta[m.id] = { course: m.course, isSelected: m.isSelected, color: m.color, name: m.name };
            }
          } else {
            // New marker
            var icon = L.divIcon({
              className: 'custom-marker',
              html: createMarkerHtml(m),
              iconSize: [40, 40],
              iconAnchor: [20, 20],
              popupAnchor: [0, -24]
            });
            var marker = L.marker(latlng, { icon: icon }).addTo(map);
            marker.on('click', function() {
              emitSelect(m.id);
            });
            markersMap[m.id] = marker;
            markersMeta[m.id] = { course: m.course, isSelected: m.isSelected, color: m.color, name: m.name };
          }
        });

        // Clean up removed markers
        Object.keys(markersMap).forEach(function(id) {
          if (!activeIds[id]) {
            map.removeLayer(markersMap[id]);
            delete markersMap[id];
            delete markersMeta[id];
          }
        });

        // 3. Viewport control — NEVER resets or flickers on normal 3.5s heartbeats!
        if (!mapInitialized) {
          // Initial fit once
          if (data.selectedDeviceId && markersMap[data.selectedDeviceId]) {
            map.setView(markersMap[data.selectedDeviceId].getLatLng(), 15);
          } else if (bounds.length > 0) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
          }
          mapInitialized = true;
          lastSelectedId = data.selectedDeviceId;
        } else {
          // If user clicked a different vehicle in the strip
          if (data.selectedDeviceId && data.selectedDeviceId !== lastSelectedId) {
            lastSelectedId = data.selectedDeviceId;
            if (markersMap[data.selectedDeviceId]) {
              map.panTo(markersMap[data.selectedDeviceId].getLatLng(), { animate: true, duration: 0.5 });
            }
          } else if (data.forceRecenter) {
            // User explicitly tapped the Crosshairs recenter button
            if (data.selectedDeviceId && markersMap[data.selectedDeviceId]) {
              map.setView(markersMap[data.selectedDeviceId].getLatLng(), 15, { animate: true });
            } else if (bounds.length > 0) {
              map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: true });
            }
          }
        }
      }

      // 4. Historical Route polyline (for playback)
      if (data.route && data.route.length > 0) {
        if (routePolyline) map.removeLayer(routePolyline);
        var coords = data.route.map(function(pt) { return [pt.latitude, pt.longitude]; });
        routePolyline = L.polyline(coords, {
          color: '#2563EB',
          weight: 5,
          opacity: 0.85
        }).addTo(map);

        if (!mapInitialized) {
          map.fitBounds(routePolyline.getBounds(), { padding: [40, 40] });
          mapInitialized = true;
        }
      }

      // 5. Playback marker (smooth position animation during playback)
      if (data.playbackPosition) {
        var pLatlng = [data.playbackPosition.latitude, data.playbackPosition.longitude];
        var pIcon = L.divIcon({
          className: 'custom-marker',
          html: '<div class="marker-pin" style="background:#2563EB; border:2.5px solid white;">' +
            '<div class="marker-rotator" style="transform: rotate(' + (data.playbackPosition.course || 0) + 'deg);">' +
              '<div class="marker-arrow" style="border-bottom: 10px solid white;"></div>' +
            '</div>' +
          '</div>',
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        if (playbackMarker) {
          playbackMarker.setLatLng(pLatlng);
        } else {
          playbackMarker = L.marker(pLatlng, { icon: pIcon }).addTo(map);
        }
      }
    };

    // Listen for postMessage from parent
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'UPDATE_DATA') {
        window.updateData(e.data.data);
      }
    });

    // Notify parent frame that map is fully ready
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'MAP_READY' }, '*');
    }
  </script>
</body>
</html>
`;

export function MapViewer({
  devices,
  positions,
  selectedDeviceId,
  onSelectDevice,
  routeCoordinates,
  playbackPosition,
  mapLayer = 'osm',
  autoFit = true,
  forceRecenter = 0,
}: MapViewerProps) {
  const webViewRef = useRef<any>(null);
  const iframeRef = useRef<any>(null);
  const isMapReadyRef = useRef<boolean>(false);

  // Prepare markers data payload
  const markers = useMemo(() => {
    return devices
      .map((dev) => {
        const pos = positions[dev.id];
        if (!pos || !pos.latitude || !pos.longitude) return null;
        const status = getDeviceOperationalStatus(dev, pos);
        const color = getStatusColor(status);
        return {
          id: dev.id,
          name: dev.name,
          lat: pos.latitude,
          lng: pos.longitude,
          course: pos.course || 0,
          speed: formatSpeed(pos.speed),
          status,
          color,
          isSelected: dev.id === selectedDeviceId,
        };
      })
      .filter(Boolean) as any[];
  }, [devices, positions, selectedDeviceId]);

  const payload = useMemo(() => ({
    markers,
    layer: mapLayer,
    route: routeCoordinates || [],
    playbackPosition,
    autoFit,
    selectedDeviceId,
    forceRecenter: forceRecenter > 0,
  }), [markers, mapLayer, routeCoordinates, playbackPosition, autoFit, selectedDeviceId, forceRecenter]);

  // Dispatch payload to existing map instance without ever reloading the container
  const sendUpdate = (data: any) => {
    if (Platform.OS === 'web') {
      try {
        if (iframeRef.current?.contentWindow?.updateData) {
          iframeRef.current.contentWindow.updateData(data);
        } else if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({ type: 'UPDATE_DATA', data }, '*');
        }
      } catch (err) {
        console.warn('Map update error:', err);
      }
    } else if (webViewRef.current) {
      const js = `if (window.updateData) { window.updateData(${JSON.stringify(data)}); } true;`;
      webViewRef.current.injectJavaScript(js);
    }
  };

  // Push updates to map whenever markers, selected device, or route coordinates change
  useEffect(() => {
    sendUpdate(payload);
  }, [payload]);

  // Web iframe message listener
  useEffect(() => {
    if (Platform.OS === 'web') {
      const onWebMessage = (e: any) => {
        try {
          const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
          if (data && data.type === 'SELECT_DEVICE' && onSelectDevice) {
            onSelectDevice(data.deviceId);
          } else if (data && data.type === 'MAP_READY') {
            isMapReadyRef.current = true;
            sendUpdate(payload);
          }
        } catch {}
      };

      if (typeof window !== 'undefined') {
        window.addEventListener('message', onWebMessage);
        return () => window.removeEventListener('message', onWebMessage);
      }
    }
  }, [onSelectDevice, payload]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'SELECT_DEVICE' && onSelectDevice) {
        onSelectDevice(data.deviceId);
      }
    } catch (err) {
      console.warn('Map message error:', err);
    }
  };

  // On Web, render an iframe directly with a CONSTANT static srcDoc
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <iframe
          ref={iframeRef}
          srcDoc={LEAFLET_STATIC_HTML}
          onLoad={() => {
            // Immediately send current payload upon iframe finish loading
            setTimeout(() => sendUpdate(payload), 100);
          }}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            backgroundColor: '#E5E7EB',
          }}
          title="GPS Track Live Map"
        />
      </View>
    );
  }

  // On Native iOS/Android, render WebView with constant static source
  return (
    <View style={styles.container}>
      <CustomWebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: LEAFLET_STATIC_HTML }}
        style={styles.webView}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onMessage={handleMessage}
        scrollEnabled={false}
        onLoadEnd={() => {
          setTimeout(() => sendUpdate(payload), 100);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E7EB',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
