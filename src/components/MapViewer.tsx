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
  userLocation?: { latitude: number; longitude: number; accuracy?: number } | null;
  trackMode?: boolean;
}

const CustomWebView = WebView as any;

// Static Leaflet HTML template with Uber-grade 60fps dead-reckoning motion engine
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
    .leaflet-marker-icon {
      will-change: transform;
    }
    .real-vehicle-marker {
      width: 44px;
      height: 56px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .vehicle-rotator {
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      filter: drop-shadow(0 3px 6px rgba(0,0,0,0.38));
      will-change: transform;
    }
    /* Selected Vehicle Pulsing Beacon */
    .radar-beacon {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 58px;
      height: 58px;
      border-radius: 50%;
      border: 2.5px solid #2563EB;
      background: rgba(37, 99, 235, 0.18);
      animation: pulseBeacon 1.8s infinite ease-out;
      pointer-events: none;
      z-index: 1;
    }
    @keyframes pulseBeacon {
      0% { transform: translate(-50%, -50%) scale(0.75); opacity: 1; }
      100% { transform: translate(-50%, -50%) scale(1.65); opacity: 0; }
    }
    /* Plate and Speed Pill */
    .vehicle-plate-pill {
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      margin-top: 3px;
      white-space: nowrap;
      font-size: 10px;
      font-weight: 800;
      color: #0F172A;
      background: rgba(255, 255, 255, 0.96);
      padding: 2px 7px;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      display: flex;
      align-items: center;
      gap: 4px;
      pointer-events: none;
      z-index: 5;
      border: 1px solid #CBD5E1;
      backdrop-filter: blur(4px);
    }
    .vehicle-plate-pill.selected-plate {
      background: #0F172A;
      color: #FFFFFF;
      border-color: #2563EB;
      box-shadow: 0 2px 10px rgba(37, 99, 235, 0.5);
    }
    .plate-speed {
      background: #10B981;
      color: #FFFFFF;
      font-size: 8.5px;
      padding: 1px 4px;
      border-radius: 4px;
      font-weight: 700;
    }
    /* Human / My Location Pin Styles */
    .human-marker-container {
      width: 44px;
      height: 56px;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      cursor: pointer;
    }
    .human-pulse-beacon {
      position: absolute;
      top: 18px;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 52px;
      height: 52px;
      border-radius: 50%;
      border: 2.5px solid #2563EB;
      background: rgba(37, 99, 235, 0.22);
      animation: humanPulse 2s infinite ease-out;
      pointer-events: none;
      z-index: 1;
    }
    @keyframes humanPulse {
      0% { transform: translate(-50%, -50%) scale(0.65); opacity: 1; }
      100% { transform: translate(-50%, -50%) scale(1.75); opacity: 0; }
    }
    .human-pin-icon {
      position: relative;
      z-index: 3;
      filter: drop-shadow(0 4px 8px rgba(0,0,0,0.38));
    }
    .human-label-pill {
      margin-top: 2px;
      font-size: 9.5px;
      font-weight: 800;
      color: #FFFFFF;
      background: #2563EB;
      padding: 2px 7px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
      white-space: nowrap;
      border: 1px solid #93C5FD;
      z-index: 4;
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
    var vehiclesState = {}; // Real-time 60fps physics & dead-reckoning state
    var routePolyline = null;
    var playbackMarker = null;
    var userMarker = null;
    var connectingLine = null;
    var currentUserLocation = null;
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

    // Helper: Shortest angular distance interpolation for realistic steering
    function lerpAngle(a, b, t) {
      var diff = (b - a) % 360;
      if (diff < -180) diff += 360;
      if (diff > 180) diff -= 360;
      return a + diff * t;
    }

    // Top-down realistic vehicle SVGs
    function getVehicleSvg(category, color, isMoving) {
      var cat = (category || 'car').toLowerCase();

      // 1. TRUCK (Semi / Cargo Truck)
      if (cat === 'truck') {
        return '<svg width="26" height="54" viewBox="0 0 26 54" fill="none">' +
          '<rect x="0" y="8" width="2.5" height="7" rx="1.2" fill="#0F172A"/>' +
          '<rect x="23.5" y="8" width="2.5" height="7" rx="1.2" fill="#0F172A"/>' +
          '<rect x="0" y="36" width="2.5" height="7" rx="1.2" fill="#0F172A"/>' +
          '<rect x="23.5" y="36" width="2.5" height="7" rx="1.2" fill="#0F172A"/>' +
          '<rect x="0" y="44" width="2.5" height="7" rx="1.2" fill="#0F172A"/>' +
          '<rect x="23.5" y="44" width="2.5" height="7" rx="1.2" fill="#0F172A"/>' +
          '<rect x="2" y="17" width="22" height="35" rx="3" fill="' + color + '" stroke="#FFFFFF" stroke-width="1.2"/>' +
          '<line x1="4" y1="24" x2="22" y2="24" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>' +
          '<line x1="4" y1="32" x2="22" y2="32" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>' +
          '<line x1="4" y1="40" x2="22" y2="40" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>' +
          '<line x1="4" y1="48" x2="22" y2="48" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>' +
          '<rect x="3" y="2" width="20" height="14" rx="3.5" fill="' + color + '" stroke="#FFFFFF" stroke-width="1.2"/>' +
          '<path d="M5 6.5 Q13 4.5 21 6.5 L20.5 9.5 Q13 8 5.5 9.5 Z" fill="#0F172A" opacity="0.85"/>' +
          (isMoving ? '<circle cx="5" cy="3" r="1.5" fill="#FEF08A"/><circle cx="21" cy="3" r="1.5" fill="#FEF08A"/>' : '') +
        '</svg>';
      }

      // 2. BUS
      if (cat === 'bus') {
        return '<svg width="24" height="52" viewBox="0 0 24 52" fill="none">' +
          '<rect x="0" y="8" width="2.5" height="7" rx="1.2" fill="#0F172A"/>' +
          '<rect x="21.5" y="8" width="2.5" height="7" rx="1.2" fill="#0F172A"/>' +
          '<rect x="0" y="38" width="2.5" height="7" rx="1.2" fill="#0F172A"/>' +
          '<rect x="21.5" y="38" width="2.5" height="7" rx="1.2" fill="#0F172A"/>' +
          '<rect x="2" y="2" width="20" height="48" rx="4" fill="' + color + '" stroke="#FFFFFF" stroke-width="1.2"/>' +
          '<path d="M4.5 5.5 Q12 4 19.5 5.5 L19 9 Q12 7.5 5 9 Z" fill="#0F172A" opacity="0.85"/>' +
          '<rect x="6.5" y="19" width="11" height="15" rx="2" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.5)" stroke-width="0.8"/>' +
          (isMoving ? '<circle cx="4.5" cy="3" r="1.5" fill="#FEF08A"/><circle cx="19.5" cy="3" r="1.5" fill="#FEF08A"/>' : '') +
        '</svg>';
      }

      // 3. MOTORCYCLE / BIKE
      if (cat === 'motorcycle' || cat === 'bike') {
        return '<svg width="18" height="38" viewBox="0 0 18 38" fill="none">' +
          '<rect x="7" y="2" width="4" height="10" rx="2" fill="#0F172A"/>' +
          '<rect x="7" y="24" width="4" height="12" rx="2" fill="#0F172A"/>' +
          '<rect x="2" y="9" width="14" height="2.5" rx="1" fill="#475569"/>' +
          '<circle cx="2" cy="10" r="1.5" fill="#0F172A"/>' +
          '<circle cx="16" cy="10" r="1.5" fill="#0F172A"/>' +
          '<ellipse cx="9" cy="18" rx="4" ry="6.5" fill="' + color + '" stroke="#FFFFFF" stroke-width="1.2"/>' +
          (isMoving ? '<circle cx="9" cy="3" r="1.5" fill="#FEF08A"/>' : '') +
        '</svg>';
      }

      // 4. VAN / PICKUP
      if (cat === 'van' || cat === 'pickup') {
        return '<svg width="22" height="44" viewBox="0 0 22 44" fill="none">' +
          '<rect x="0" y="7" width="2.5" height="6" rx="1" fill="#0F172A"/>' +
          '<rect x="19.5" y="7" width="2.5" height="6" rx="1" fill="#0F172A"/>' +
          '<rect x="0" y="30" width="2.5" height="6" rx="1" fill="#0F172A"/>' +
          '<rect x="19.5" y="30" width="2.5" height="6" rx="1" fill="#0F172A"/>' +
          '<rect x="2" y="2" width="18" height="40" rx="4" fill="' + color + '" stroke="#FFFFFF" stroke-width="1.2"/>' +
          '<path d="M4.5 9.5 Q11 7 17.5 9.5 L17 13.5 Q11 11.5 5 13.5 Z" fill="#0F172A" opacity="0.85"/>' +
          '<line x1="4.5" y1="20" x2="17.5" y2="20" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>' +
          '<line x1="4.5" y1="27" x2="17.5" y2="27" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>' +
          (isMoving ? '<circle cx="4.5" cy="3" r="1.5" fill="#FEF08A"/><circle cx="17.5" cy="3" r="1.5" fill="#FEF08A"/>' : '') +
        '</svg>';
      }

      // 5. DEFAULT: Top-down Real Sedan / Car
      return '<svg width="22" height="42" viewBox="0 0 22 42" fill="none">' +
        '<rect x="0" y="6" width="2.5" height="6" rx="1.2" fill="#0F172A"/>' +
        '<rect x="19.5" y="6" width="2.5" height="6" rx="1.2" fill="#0F172A"/>' +
        '<rect x="0" y="28" width="2.5" height="6" rx="1.2" fill="#0F172A"/>' +
        '<rect x="19.5" y="28" width="2.5" height="6" rx="1.2" fill="#0F172A"/>' +
        '<rect x="2" y="2" width="18" height="38" rx="5" fill="' + color + '" stroke="#FFFFFF" stroke-width="1.3"/>' +
        '<path d="M4.5 11 Q11 8.5 17.5 11 L16.5 15.5 Q11 13.5 5.5 15.5 Z" fill="#0F172A" opacity="0.85"/>' +
        '<rect x="5" y="15.5" width="12" height="11" rx="2" fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.35)" stroke-width="0.8"/>' +
        '<path d="M5.5 26.5 Q11 28.5 16.5 26.5 L17 30 Q11 31.5 5 30 Z" fill="#0F172A" opacity="0.85"/>' +
        (isMoving ? '<circle cx="4.5" cy="3" r="1.5" fill="#FEF08A"/><circle cx="17.5" cy="3" r="1.5" fill="#FEF08A"/>' : '') +
        '<rect x="3.5" y="38.5" width="2.5" height="1.2" rx="0.6" fill="#EF4444"/>' +
        '<rect x="16" y="38.5" width="2.5" height="1.2" rx="0.6" fill="#EF4444"/>' +
      '</svg>';
    }

    // Human / Pedestrian Location Pin HTML (Replaces generic blue dot)
    function getHumanPinHtml() {
      return '<div class="human-marker-container">' +
        '<div class="human-pulse-beacon"></div>' +
        '<div class="human-pin-icon">' +
          '<svg width="34" height="42" viewBox="0 0 34 42" fill="none">' +
            '<path d="M17 0 C7.6 0 0 7.6 0 17 C0 27 17 42 17 42 C17 42 34 27 34 17 C34 7.6 26.4 0 17 0 Z" fill="#2563EB" stroke="#FFFFFF" stroke-width="1.8"/>' +
            '<circle cx="17" cy="15.5" r="10.5" fill="#FFFFFF"/>' +
            '<!-- Stylized Human Figure (Head & Body) -->' +
            '<circle cx="17" cy="11.5" r="3.2" fill="#2563EB"/>' +
            '<path d="M10.8 21.5 C10.8 17.2 13.5 16 17 16 C20.5 16 23.2 17.2 23.2 21.5 Z" fill="#2563EB"/>' +
          '</svg>' +
        '</div>' +
        '<div class="human-label-pill">You</div>' +
      '</div>';
    }

    function createMarkerHtml(m) {
      var isMoving = (m.speedKmh > 0);
      var selectedRing = m.isSelected
        ? '<div class="radar-beacon"></div>'
        : '';

      return '<div class="real-vehicle-marker" id="veh-' + m.id + '">' +
        selectedRing +
        '<div class="vehicle-rotator" style="transform: rotate(' + (m.course || 0) + 'deg);">' +
          getVehicleSvg(m.category, m.color, isMoving) +
        '</div>' +
        '<div class="vehicle-plate-pill ' + (m.isSelected ? 'selected-plate' : '') + '">' +
          '<span class="plate-name">' + m.name + '</span>' +
          (isMoving ? '<span class="plate-speed">' + m.speed + '</span>' : '') +
        '</div>' +
      '</div>';
    }

    function emitSelect(deviceId) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_DEVICE', deviceId: deviceId }));
      } else if (window.parent) {
        window.parent.postMessage({ type: 'SELECT_DEVICE', deviceId: deviceId }, '*');
      }
    }

    // =========================================================================
    // Uber-Style 60 FPS Dead-Reckoning Continuous Drive Loop
    // Vehicles move continuously forward even between server heartbeats!
    // =========================================================================
    var lastAnimTime = performance.now();

    function animateVehicles(now) {
      var dt = (now - lastAnimTime) / 1000;
      lastAnimTime = now;
      if (dt > 0.25) dt = 0.05; // clamp when switching browser tabs

      Object.keys(vehiclesState).forEach(function(id) {
        var vs = vehiclesState[id];
        if (!vs || !vs.marker) return;

        // Smooth acceleration/deceleration
        vs.currentSpeedMps += (vs.targetSpeedMps - vs.currentSpeedMps) * Math.min(dt * 3.5, 0.25);

        // Smooth steering angle
        vs.currentCourse = lerpAngle(vs.currentCourse, vs.targetCourse, Math.min(dt * 4.5, 0.25));

        if (vs.currentSpeedMps > 0.4) {
          // 1. Advance vehicle forward along bearing at its exact speed (continuous Uber drive)
          var rad = (vs.currentCourse * Math.PI) / 180;
          var dist = vs.currentSpeedMps * dt;
          var latRad = (vs.currentLat * Math.PI) / 180;
          var cosLat = Math.cos(latRad) || 1;

          var dLat = (dist * Math.cos(rad)) / 111139;
          var dLng = (dist * Math.sin(rad)) / (111139 * cosLat);

          vs.currentLat += dLat;
          vs.currentLng += dLng;

          // 2. Gentle convergence pull towards actual target GPS fix to maintain lane precision
          var errLat = vs.targetLat - vs.currentLat;
          var errLng = vs.targetLng - vs.currentLng;
          var pull = Math.min(dt * 1.5, 0.12);
          vs.currentLat += errLat * pull;
          vs.currentLng += errLng * pull;

          // 60fps hardware update to Leaflet marker
          vs.marker.setLatLng([vs.currentLat, vs.currentLng]);
        } else {
          // Vehicle stationary: gently settle onto exact parking spot
          var errLat = vs.targetLat - vs.currentLat;
          var errLng = vs.targetLng - vs.currentLng;
          if (Math.abs(errLat) > 0.0000005 || Math.abs(errLng) > 0.0000005) {
            vs.currentLat += errLat * Math.min(dt * 5.0, 0.25);
            vs.currentLng += errLng * Math.min(dt * 5.0, 0.25);
            vs.marker.setLatLng([vs.currentLat, vs.currentLng]);
          }
        }

        // Live rotation update for car steering
        var el = vs.marker.getElement();
        if (el) {
          var rot = el.querySelector('.vehicle-rotator');
          if (rot) {
            rot.style.transform = 'rotate(' + vs.currentCourse.toFixed(1) + 'deg)';
          }
        }
      });

      // Dynamically stretch connecting route line to target moving vehicle
      if (connectingLine && currentUserLocation && lastSelectedId && vehiclesState[lastSelectedId]) {
        var vsTrack = vehiclesState[lastSelectedId];
        connectingLine.setLatLngs([
          [currentUserLocation.latitude, currentUserLocation.longitude],
          [vsTrack.currentLat, vsTrack.currentLng]
        ]);
      }

      requestAnimationFrame(animateVehicles);
    }

    // Start 60fps animation engine immediately
    requestAnimationFrame(animateVehicles);

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
          var vs = vehiclesState[m.id];

          if (existing && vs) {
            // Update physics targets
            vs.targetLat = m.lat;
            vs.targetLng = m.lng;
            vs.targetCourse = m.course || 0;
            vs.targetSpeedMps = ((m.speedKmh || 0) * 1000) / 3600;

            // If teleport/initial jump > 400m, snap directly
            var dLatDeg = Math.abs(vs.targetLat - vs.currentLat);
            var dLngDeg = Math.abs(vs.targetLng - vs.currentLng);
            if (dLatDeg > 0.004 || dLngDeg > 0.004) {
              vs.currentLat = vs.targetLat;
              vs.currentLng = vs.targetLng;
              vs.currentCourse = vs.targetCourse;
              vs.currentSpeedMps = vs.targetSpeedMps;
              vs.marker.setLatLng([vs.currentLat, vs.currentLng]);
            }

            // Update DOM attributes if category, selection, or status color changed
            if (
              !meta ||
              meta.isSelected !== m.isSelected ||
              meta.color !== m.color ||
              meta.name !== m.name ||
              meta.category !== m.category ||
              meta.speedKmh !== m.speedKmh
            ) {
              existing.setIcon(L.divIcon({
                className: 'custom-marker',
                html: createMarkerHtml(m),
                iconSize: [44, 56],
                iconAnchor: [22, 28],
                popupAnchor: [0, -28]
              }));
              markersMeta[m.id] = {
                course: m.course,
                isSelected: m.isSelected,
                color: m.color,
                name: m.name,
                category: m.category,
                speedKmh: m.speedKmh,
              };
            }
          } else {
            // New marker initialization
            var icon = L.divIcon({
              className: 'custom-marker',
              html: createMarkerHtml(m),
              iconSize: [44, 56],
              iconAnchor: [22, 28],
              popupAnchor: [0, -28]
            });
            var marker = L.marker(latlng, { icon: icon }).addTo(map);
            marker.on('click', function() {
              emitSelect(m.id);
            });
            markersMap[m.id] = marker;
            markersMeta[m.id] = {
              course: m.course,
              isSelected: m.isSelected,
              color: m.color,
              name: m.name,
              category: m.category,
              speedKmh: m.speedKmh,
            };
            // Register in dead-reckoning state
            vehiclesState[m.id] = {
              marker: marker,
              currentLat: m.lat,
              currentLng: m.lng,
              targetLat: m.lat,
              targetLng: m.lng,
              currentCourse: m.course || 0,
              targetCourse: m.course || 0,
              currentSpeedMps: ((m.speedKmh || 0) * 1000) / 3600,
              targetSpeedMps: ((m.speedKmh || 0) * 1000) / 3600,
            };
          }
        });

        // Clean up removed markers
        Object.keys(markersMap).forEach(function(id) {
          if (!activeIds[id]) {
            map.removeLayer(markersMap[id]);
            delete markersMap[id];
            delete markersMeta[id];
            delete vehiclesState[id];
          }
        });

        // 3. Viewport control — Automatically frames BOTH Human & Vehicle when both exist!
        var targetMarker = (data.selectedDeviceId && markersMap[data.selectedDeviceId])
          ? markersMap[data.selectedDeviceId]
          : null;

        if (currentUserLocation && targetMarker) {
          var userPt = [currentUserLocation.latitude, currentUserLocation.longitude];
          var vehPt = targetMarker.getLatLng();
          if (!mapInitialized || data.forceRecenter || data.selectedDeviceId !== lastSelectedId) {
            map.fitBounds([userPt, vehPt], { padding: [90, 90], maxZoom: 16, animate: true });
            mapInitialized = true;
            lastSelectedId = data.selectedDeviceId;
          }
        } else if (!mapInitialized) {
          if (targetMarker) {
            map.setView(targetMarker.getLatLng(), 15);
          } else if (bounds.length > 0) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
          }
          mapInitialized = true;
          lastSelectedId = data.selectedDeviceId;
        } else {
          if (data.selectedDeviceId && data.selectedDeviceId !== lastSelectedId) {
            lastSelectedId = data.selectedDeviceId;
            if (targetMarker) {
              map.panTo(targetMarker.getLatLng(), { animate: true, duration: 0.5 });
            }
          } else if (data.forceRecenter) {
            if (targetMarker) {
              map.setView(targetMarker.getLatLng(), 15, { animate: true });
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
          html: '<div class="real-vehicle-marker">' +
            '<div class="vehicle-rotator" style="transform: rotate(' + (data.playbackPosition.course || 0) + 'deg);">' +
              getVehicleSvg('car', '#2563EB', true) +
            '</div>' +
          '</div>',
          iconSize: [44, 56],
          iconAnchor: [22, 28]
        });

        if (playbackMarker) {
          playbackMarker.setLatLng(pLatlng);
        } else {
          playbackMarker = L.marker(pLatlng, { icon: pIcon }).addTo(map);
        }
      }

      // 6. User Location (Human Pin) & Direct Connecting Path to Vehicle
      if (data.userLocation && data.userLocation.latitude && data.userLocation.longitude) {
        var isFirstUserLoc = !currentUserLocation;
        currentUserLocation = data.userLocation;
        var uLatlng = [data.userLocation.latitude, data.userLocation.longitude];

        if (userMarker) {
          userMarker.setLatLng(uLatlng);
        } else {
          var humanIcon = L.divIcon({
            className: 'custom-marker',
            html: getHumanPinHtml(),
            iconSize: [44, 56],
            iconAnchor: [22, 42],
            popupAnchor: [0, -42]
          });
          userMarker = L.marker(uLatlng, { icon: humanIcon, zIndexOffset: 2000 }).addTo(map);
        }

        // Draw dynamic connecting line between Human and Target Vehicle
        if (data.selectedDeviceId && markersMap[data.selectedDeviceId]) {
          var vLatLng = markersMap[data.selectedDeviceId].getLatLng();
          var linePts = [uLatlng, [vLatLng.lat, vLatLng.lng]];

          if (connectingLine) {
            connectingLine.setLatLngs(linePts);
          } else {
            connectingLine = L.polyline(linePts, {
              color: '#EA580C',
              weight: 3.5,
              dashArray: '7, 8',
              opacity: 0.9
            }).addTo(map);
          }

          // Frame BOTH You (Human) and Vehicle on initial detection or when Track Mode / Recenter is active!
          if (isFirstUserLoc || data.trackMode || data.forceRecenter) {
            map.fitBounds([uLatlng, [vLatLng.lat, vLatLng.lng]], {
              padding: [90, 90],
              maxZoom: 16,
              animate: true
            });
          }
        } else {
          if (connectingLine) {
            map.removeLayer(connectingLine);
            connectingLine = null;
          }
        }
      } else {
        currentUserLocation = null;
        if (userMarker) {
          map.removeLayer(userMarker);
          userMarker = null;
        }
        if (connectingLine) {
          map.removeLayer(connectingLine);
          connectingLine = null;
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
  userLocation = null,
  trackMode = false,
}: MapViewerProps) {
  const webViewRef = useRef<any>(null);
  const iframeRef = useRef<any>(null);
  const isMapReadyRef = useRef<boolean>(false);

  // Prepare markers data payload with real category and calculated speed
  const markers = useMemo(() => {
    return devices
      .map((dev) => {
        const pos = positions[dev.id];
        if (!pos || !pos.latitude || !pos.longitude) return null;
        const status = getDeviceOperationalStatus(dev, pos);
        const color = getStatusColor(status);
        const speedKmh = pos.speed ? Math.round(pos.speed * 1.852) : 0;
        return {
          id: dev.id,
          name: dev.name,
          category: dev.category || 'car',
          lat: pos.latitude,
          lng: pos.longitude,
          course: pos.course || 0,
          speed: speedKmh > 0 ? `${speedKmh} km/h` : '0 km/h',
          speedKmh,
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
    userLocation,
    trackMode,
  }), [markers, mapLayer, routeCoordinates, playbackPosition, autoFit, selectedDeviceId, forceRecenter, userLocation, trackMode]);

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
