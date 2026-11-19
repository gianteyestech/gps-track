import React, { useRef, useEffect } from 'react';
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
}

const CustomWebView = WebView as any;

export function MapViewer({
  devices,
  positions,
  selectedDeviceId,
  onSelectDevice,
  routeCoordinates,
  playbackPosition,
  mapLayer = 'osm',
  autoFit = true,
}: MapViewerProps) {
  const webViewRef = useRef<any>(null);
  const iframeRef = useRef<any>(null);

  // Prepare markers data payload
  const markers = devices
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

  // Default initial center: selected device, first device, or fallback (Lahore, Pakistan)
  const defaultCenter =
    markers.length > 0
      ? [markers[0].lat, markers[0].lng]
      : [31.5204, 74.3587];

  const payload = {
    markers,
    layer: mapLayer,
    route: routeCoordinates || [],
    playbackPosition,
    autoFit,
    shouldFollow: !!selectedDeviceId,
  };

  // Generate HTML for Leaflet Map with Google Maps Live Traffic
  const leafletHtml = `
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
      transition: transform 0.25s ease;
      cursor: pointer;
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
    var initialCenter = [${defaultCenter[0]}, ${defaultCenter[1]}];
    var map = L.map('map', {
      zoomControl: true,
      attributionControl: false
    }).setView(initialCenter, 13);

    var currentTileLayer = null;
    function setLayer(layerType) {
      if (currentTileLayer) map.removeLayer(currentTileLayer);
      if (layerType === 'satellite') {
        currentTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });
      } else if (layerType === 'dark') {
        currentTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd' });
      } else {
        // Standard Google Maps with Live Traffic
        currentTileLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}', {
          maxZoom: 20,
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
        });
      }
      currentTileLayer.addTo(map);
    }
    setLayer('${mapLayer}');

    var markersMap = {};
    var routePolyline = null;
    var playbackMarker = null;

    function createMarkerHtml(m) {
      var pulse = m.isSelected
        ? 'border: 3px solid #2563EB; transform: scale(1.18); box-shadow: 0 0 16px rgba(37,99,235,0.6);'
        : 'border: 2.5px solid ' + m.color + ';';
      return '<div class="marker-pin" style="' + pulse + '">' +
        '<div style="transform: rotate(' + m.course + 'deg); width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">' +
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
      if (data.layer) setLayer(data.layer);

      if (data.markers && data.markers.length > 0) {
        var bounds = [];
        var activeIds = {};

        data.markers.forEach(function(m) {
          activeIds[m.id] = true;
          var latlng = [m.lat, m.lng];
          bounds.push(latlng);

          var icon = L.divIcon({
            className: 'custom-marker',
            html: createMarkerHtml(m),
            iconSize: [40, 40],
            iconAnchor: [20, 20],
            popupAnchor: [0, -24]
          });

          if (markersMap[m.id]) {
            markersMap[m.id].setLatLng(latlng);
            markersMap[m.id].setIcon(icon);
          } else {
            var marker = L.marker(latlng, { icon: icon }).addTo(map);
            marker.on('click', function() {
              emitSelect(m.id);
            });
            markersMap[m.id] = marker;
          }

          if (m.isSelected && data.shouldFollow) {
            map.panTo(latlng, { animate: true, duration: 0.6 });
          }
        });

        // Clean stale markers
        Object.keys(markersMap).forEach(function(id) {
          if (!activeIds[id]) {
            map.removeLayer(markersMap[id]);
            delete markersMap[id];
          }
        });

        if (data.autoFit && bounds.length > 0 && !data.shouldFollow) {
          map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
        }
      }

      // Route polyline
      if (data.route && data.route.length > 0) {
        if (routePolyline) map.removeLayer(routePolyline);
        var coords = data.route.map(function(pt) { return [pt.latitude, pt.longitude]; });
        routePolyline = L.polyline(coords, {
          color: '#2563EB',
          weight: 5,
          opacity: 0.85
        }).addTo(map);

        map.fitBounds(routePolyline.getBounds(), { padding: [40, 40] });
      }

      // Playback marker
      if (data.playbackPosition) {
        var pLatlng = [data.playbackPosition.latitude, data.playbackPosition.longitude];
        var pIcon = L.divIcon({
          className: 'custom-marker',
          html: '<div class="marker-pin" style="background:#2563EB; border:2px solid white;">' +
            '<div style="transform: rotate(' + (data.playbackPosition.course || 0) + 'deg); width:100%; height:100%; display:flex; align-items:center; justify-content:center;">' +
              '<div class="marker-arrow" style="border-bottom: 10px solid white;"></div>' +
            '</div>' +
          '</div>',
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        if (playbackMarker) {
          playbackMarker.setLatLng(pLatlng);
          playbackMarker.setIcon(pIcon);
        } else {
          playbackMarker = L.marker(pLatlng, { icon: pIcon }).addTo(map);
        }
        map.panTo(pLatlng, { animate: true, duration: 0.2 });
      }
    };

    // Pre-load with initial markers right away
    window.updateData(${JSON.stringify(payload)});

    // Notify parent frame ready
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'MAP_READY' }, '*');
    }
  </script>
</body>
</html>
  `;

  // Push updates to map whenever markers, selected device, or route coordinates change
  useEffect(() => {
    if (Platform.OS === 'web') {
      if (
        iframeRef.current &&
        iframeRef.current.contentWindow &&
        iframeRef.current.contentWindow.updateData
      ) {
        iframeRef.current.contentWindow.updateData(payload);
      }
    } else if (webViewRef.current) {
      const js = `if (window.updateData) { window.updateData(${JSON.stringify(payload)}); } true;`;
      webViewRef.current.injectJavaScript(js);
    }
  }, [markers, mapLayer, routeCoordinates, playbackPosition, autoFit, selectedDeviceId]);

  // Web iframe message listener
  useEffect(() => {
    if (Platform.OS === 'web') {
      const onWebMessage = (e: any) => {
        try {
          const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
          if (data && data.type === 'SELECT_DEVICE' && onSelectDevice) {
            onSelectDevice(data.deviceId);
          } else if (data && data.type === 'MAP_READY') {
            if (iframeRef.current?.contentWindow?.updateData) {
              iframeRef.current.contentWindow.updateData(payload);
            }
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

  // On Web, render an iframe directly; on iOS/Android, render WebView
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <iframe
          ref={iframeRef}
          srcDoc={leafletHtml}
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

  return (
    <View style={styles.container}>
      <CustomWebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: leafletHtml }}
        style={styles.webView}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onMessage={handleMessage}
        scrollEnabled={false}
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
