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
      will-change: transform;
    }
    /* Selected Vehicle Pulsing Beacon */
    .radar-beacon {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 52px;
      height: 52px;
      border-radius: 50%;
      border: 2px solid #2563EB;
      background: rgba(37, 99, 235, 0.16);
      animation: pulseBeacon 1.8s infinite ease-out;
      pointer-events: none;
      z-index: 1;
    }
    @keyframes pulseBeacon {
      0% { transform: translate(-50%, -50%) scale(0.7); opacity: 1; }
      100% { transform: translate(-50%, -50%) scale(1.6); opacity: 0; }
    }
    /* Plate and Speed Pill */
    .vehicle-plate-pill {
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      margin-top: 2px;
      white-space: nowrap;
      font-size: 9.5px;
      font-weight: 700;
      color: #0F172A;
      background: rgba(255, 255, 255, 0.96);
      padding: 1.5px 6px;
      border-radius: 5px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.22);
      display: flex;
      align-items: center;
      gap: 3px;
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
      font-size: 8px;
      padding: 1px 4px;
      border-radius: 3px;
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

    // Top-down realistic 3D vehicle SVGs with metallic gradients, glass reflections, and road drop shadows
    function getGradientShades(color) {
      var c = (color || '#DC2626').toLowerCase();
      // Emerald / Green (Moving)
      if (c.indexOf('#10b') !== -1 || c.indexOf('#059') !== -1 || c.indexOf('#22c') !== -1 || c.indexOf('#16a') !== -1) {
        return { dark: '#064E3B', base: '#059669', light: '#34D399', highlight: '#6EE7B7' };
      }
      // Yellow / Amber (Idle)
      if (c.indexOf('#f59') !== -1 || c.indexOf('#eab') !== -1 || c.indexOf('#d97') !== -1 || c.indexOf('#e85') !== -1) {
        return { dark: '#78350F', base: '#D97706', light: '#FBBF24', highlight: '#FDE68A' };
      }
      // Blue (Selected / Primary)
      if (c.indexOf('#256') !== -1 || c.indexOf('#3b8') !== -1 || c.indexOf('#1d4') !== -1) {
        return { dark: '#1E3A8A', base: '#2563EB', light: '#60A5FA', highlight: '#93C5FD' };
      }
      // Slate / Gray (Offline / Unknown)
      if (c.indexOf('#647') !== -1 || c.indexOf('#475') !== -1 || c.indexOf('#94a') !== -1) {
        return { dark: '#1E293B', base: '#475569', light: '#94A3B8', highlight: '#CBD5E1' };
      }
      // Default Crimson Red (Stopped / Parked, exactly matching client screenshot)
      return { dark: '#7F1D1D', base: '#DC2626', light: '#F87171', highlight: '#FCA5A5' };
    }

    function getVehicleSvg(category, color, isMoving, devId) {
      var cat = (category || 'car').toLowerCase();
      var s = getGradientShades(color);
      var uid = 'v' + (devId || Math.floor(Math.random() * 100000));

      var commonDefs = '<defs>' +
        '<linearGradient id="b_' + uid + '" x1="0" y1="0" x2="24" y2="0" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0%" stop-color="' + s.dark + '"/>' +
          '<stop offset="20%" stop-color="' + s.base + '"/>' +
          '<stop offset="50%" stop-color="' + s.light + '"/>' +
          '<stop offset="80%" stop-color="' + s.base + '"/>' +
          '<stop offset="100%" stop-color="' + s.dark + '"/>' +
        '</linearGradient>' +
        '<linearGradient id="r_' + uid + '" x1="4" y1="16" x2="20" y2="16" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0%" stop-color="' + s.dark + '"/>' +
          '<stop offset="45%" stop-color="' + s.base + '"/>' +
          '<stop offset="55%" stop-color="' + s.highlight + '"/>' +
          '<stop offset="100%" stop-color="' + s.dark + '"/>' +
        '</linearGradient>' +
        '<linearGradient id="g_' + uid + '" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0%" stop-color="#0F172A"/>' +
          '<stop offset="35%" stop-color="#1E293B"/>' +
          '<stop offset="52%" stop-color="#64748B"/>' +
          '<stop offset="60%" stop-color="#CBD5E1"/>' +
          '<stop offset="68%" stop-color="#1E293B"/>' +
          '<stop offset="100%" stop-color="#0F172A"/>' +
        '</linearGradient>' +
        '<filter id="sh_' + uid + '" x="-20%" y="-20%" width="140%" height="140%">' +
          '<feDropShadow dx="0" dy="2.2" stdDeviation="1.6" flood-color="#000000" flood-opacity="0.45"/>' +
        '</filter>' +
      '</defs>';

      // 1. TRUCK (Heavy-Duty Semi / Cargo Carrier)
      if (cat === 'truck') {
        return '<svg width="26" height="54" viewBox="0 0 26 54" fill="none">' +
          commonDefs +
          '<g filter="url(#sh_' + uid + ')">' +
            '<rect x="0.5" y="8" width="2.6" height="7" rx="1.2" fill="#18181B"/>' +
            '<rect x="22.9" y="8" width="2.6" height="7" rx="1.2" fill="#18181B"/>' +
            '<rect x="0.5" y="36" width="2.6" height="7" rx="1.2" fill="#18181B"/>' +
            '<rect x="22.9" y="36" width="2.6" height="7" rx="1.2" fill="#18181B"/>' +
            '<rect x="0.5" y="44" width="2.6" height="7" rx="1.2" fill="#18181B"/>' +
            '<rect x="22.9" y="44" width="2.6" height="7" rx="1.2" fill="#18181B"/>' +
            '<rect x="2.5" y="18" width="21" height="34" rx="2.5" fill="url(#b_' + uid + ')" stroke="#FFFFFF" stroke-width="0.8"/>' +
            '<line x1="4.5" y1="24" x2="21.5" y2="24" stroke="rgba(255,255,255,0.4)" stroke-width="0.8"/>' +
            '<line x1="4.5" y1="31" x2="21.5" y2="31" stroke="rgba(255,255,255,0.4)" stroke-width="0.8"/>' +
            '<line x1="4.5" y1="38" x2="21.5" y2="38" stroke="rgba(255,255,255,0.4)" stroke-width="0.8"/>' +
            '<line x1="4.5" y1="45" x2="21.5" y2="45" stroke="rgba(255,255,255,0.4)" stroke-width="0.8"/>' +
            '<rect x="3.2" y="2" width="19.6" height="14.5" rx="3.5" fill="url(#b_' + uid + ')" stroke="#FFFFFF" stroke-width="0.8"/>' +
            '<path d="M 5 6 Q 13 4 21 6 L 20.2 9.5 Q 13 7.8 5.8 9.5 Z" fill="url(#g_' + uid + ')"/>' +
            '<rect x="0.8" y="5" width="2" height="4.5" rx="0.8" fill="#1E293B"/>' +
            '<rect x="23.2" y="5" width="2" height="4.5" rx="0.8" fill="#1E293B"/>' +
            '<circle cx="5.5" cy="3" r="1.5" fill="' + (isMoving ? '#FEF08A' : '#E2E8F0') + '"/>' +
            '<circle cx="20.5" cy="3" r="1.5" fill="' + (isMoving ? '#FEF08A' : '#E2E8F0') + '"/>' +
            '<rect x="3.5" y="51" width="3.5" height="1.4" rx="0.6" fill="#EF4444"/>' +
            '<rect x="19" y="51" width="3.5" height="1.4" rx="0.6" fill="#EF4444"/>' +
          '</g>' +
        '</svg>';
      }

      // 2. BUS (Coach / Transit Bus)
      if (cat === 'bus') {
        return '<svg width="24" height="52" viewBox="0 0 24 52" fill="none">' +
          commonDefs +
          '<g filter="url(#sh_' + uid + ')">' +
            '<rect x="0.8" y="8" width="2.4" height="6.5" rx="1.2" fill="#18181B"/>' +
            '<rect x="20.8" y="8" width="2.4" height="6.5" rx="1.2" fill="#18181B"/>' +
            '<rect x="0.8" y="38" width="2.4" height="6.5" rx="1.2" fill="#18181B"/>' +
            '<rect x="20.8" y="38" width="2.4" height="6.5" rx="1.2" fill="#18181B"/>' +
            '<rect x="2.4" y="2" width="19.2" height="48" rx="4.5" fill="url(#b_' + uid + ')" stroke="#FFFFFF" stroke-width="0.8"/>' +
            '<path d="M 4.5 5.5 Q 12 3.8 19.5 5.5 L 18.8 9.5 Q 12 7.8 5.2 9.5 Z" fill="url(#g_' + uid + ')"/>' +
            '<rect x="7" y="19" width="10" height="15" rx="2.5" fill="url(#r_' + uid + ')" stroke="rgba(255,255,255,0.4)" stroke-width="0.8"/>' +
            '<line x1="8.5" y1="23" x2="15.5" y2="23" stroke="rgba(0,0,0,0.3)" stroke-width="0.7"/>' +
            '<line x1="8.5" y1="26.5" x2="15.5" y2="26.5" stroke="rgba(0,0,0,0.3)" stroke-width="0.7"/>' +
            '<line x1="8.5" y1="30" x2="15.5" y2="30" stroke="rgba(0,0,0,0.3)" stroke-width="0.7"/>' +
            '<rect x="1" y="5.5" width="1.8" height="4" rx="0.7" fill="#1E293B"/>' +
            '<rect x="21.2" y="5.5" width="1.8" height="4" rx="0.7" fill="#1E293B"/>' +
            '<circle cx="4.8" cy="3.5" r="1.4" fill="' + (isMoving ? '#FEF08A' : '#E2E8F0') + '"/>' +
            '<circle cx="19.2" cy="3.5" r="1.4" fill="' + (isMoving ? '#FEF08A' : '#E2E8F0') + '"/>' +
            '<rect x="3.8" y="48.5" width="3" height="1.2" rx="0.6" fill="#EF4444"/>' +
            '<rect x="17.2" y="48.5" width="3" height="1.2" rx="0.6" fill="#EF4444"/>' +
          '</g>' +
        '</svg>';
      }

      // 3. MOTORCYCLE / BIKE
      if (cat === 'motorcycle' || cat === 'bike') {
        return '<svg width="18" height="38" viewBox="0 0 18 38" fill="none">' +
          commonDefs +
          '<g filter="url(#sh_' + uid + ')">' +
            '<rect x="7" y="2" width="4" height="9" rx="2" fill="#18181B"/>' +
            '<rect x="7" y="25" width="4" height="11" rx="2" fill="#18181B"/>' +
            '<line x1="2" y1="9" x2="16" y2="9" stroke="#94A3B8" stroke-width="2.2" stroke-linecap="round"/>' +
            '<circle cx="2" cy="9" r="1.4" fill="#18181B"/>' +
            '<circle cx="16" cy="9" r="1.4" fill="#18181B"/>' +
            '<ellipse cx="9" cy="18" rx="4.5" ry="7" fill="url(#b_' + uid + ')" stroke="#FFFFFF" stroke-width="0.8"/>' +
            '<circle cx="9" cy="18" r="3.2" fill="#0F172A"/>' +
            '<path d="M 6.8 16.5 Q 9 15.2 11.2 16.5" stroke="#38BDF8" stroke-width="1.2" stroke-linecap="round"/>' +
            '<circle cx="9" cy="3" r="1.5" fill="' + (isMoving ? '#FEF08A' : '#E2E8F0') + '"/>' +
            '<rect x="7.5" y="35" width="3" height="1.2" rx="0.6" fill="#EF4444"/>' +
          '</g>' +
        '</svg>';
      }

      // 4. VAN / SUV / PICKUP
      if (cat === 'van' || cat === 'pickup' || cat === 'suv') {
        return '<svg width="24" height="46" viewBox="0 0 24 46" fill="none">' +
          commonDefs +
          '<g filter="url(#sh_' + uid + ')">' +
            '<rect x="0.8" y="7" width="2.4" height="6.5" rx="1.2" fill="#18181B"/>' +
            '<rect x="20.8" y="7" width="2.4" height="6.5" rx="1.2" fill="#18181B"/>' +
            '<rect x="0.8" y="30" width="2.4" height="6.5" rx="1.2" fill="#18181B"/>' +
            '<rect x="20.8" y="30" width="2.4" height="6.5" rx="1.2" fill="#18181B"/>' +
            '<rect x="2.5" y="2" width="19" height="42" rx="4.5" fill="url(#b_' + uid + ')" stroke="#FFFFFF" stroke-width="0.8"/>' +
            '<path d="M 4.5 9.5 Q 12 7.5 19.5 9.5 L 18.5 14 Q 12 12 5.5 14 Z" fill="url(#g_' + uid + ')"/>' +
            '<line x1="5.5" y1="17" x2="5.5" y2="35" stroke="#CBD5E1" stroke-width="1.2" stroke-linecap="round"/>' +
            '<line x1="18.5" y1="17" x2="18.5" y2="35" stroke="#CBD5E1" stroke-width="1.2" stroke-linecap="round"/>' +
            '<rect x="8" y="17" width="8" height="17" rx="2" fill="url(#r_' + uid + ')" stroke="rgba(255,255,255,0.3)" stroke-width="0.6"/>' +
            '<path d="M 2.2 11.5 C 1 11.2, 1 13.2, 2.4 13.5 Z" fill="' + s.base + '" stroke="#1E293B" stroke-width="0.5"/>' +
            '<path d="M 21.8 11.5 C 23 11.2, 23 13.2, 21.6 13.5 Z" fill="' + s.base + '" stroke="#1E293B" stroke-width="0.5"/>' +
            '<path d="M 5 36.5 Q 12 37.8 19 36.5 L 19 39 Q 12 40 5 39 Z" fill="url(#g_' + uid + ')"/>' +
            '<circle cx="5" cy="3.8" r="1.5" fill="' + (isMoving ? '#FEF08A' : '#E2E8F0') + '"/>' +
            '<circle cx="19" cy="3.8" r="1.5" fill="' + (isMoving ? '#FEF08A' : '#E2E8F0') + '"/>' +
            '<rect x="3.8" y="42.5" width="3" height="1.2" rx="0.6" fill="#EF4444"/>' +
            '<rect x="17.2" y="42.5" width="3" height="1.2" rx="0.6" fill="#EF4444"/>' +
          '</g>' +
        '</svg>';
      }

      // 5. DEFAULT: Sleek Top-Down 3D Sports Sedan / Car (Matching Client Screenshot)
      return '<svg width="24" height="46" viewBox="0 0 24 46" fill="none">' +
        commonDefs +
        '<g filter="url(#sh_' + uid + ')">' +
          '<rect x="0.8" y="7" width="2.4" height="6.5" rx="1.2" fill="#18181B"/>' +
          '<rect x="20.8" y="7" width="2.4" height="6.5" rx="1.2" fill="#18181B"/>' +
          '<rect x="0.8" y="30" width="2.4" height="6.5" rx="1.2" fill="#18181B"/>' +
          '<rect x="20.8" y="30" width="2.4" height="6.5" rx="1.2" fill="#18181B"/>' +
          '<path d="M 12 1.5 C 16 1.5, 19.5 3.5, 20.2 7.5 C 20.8 11, 20.5 15, 19.5 19 C 19 21, 19.2 24, 20.2 27 C 21 30, 20.8 35, 20 39.5 C 19 44, 15 44.5, 12 44.5 C 9 44.5, 5 44, 4 39.5 C 3.2 35, 3 30, 3.8 27 C 4.8 24, 5 21, 4.5 19 C 3.5 15, 3.2 11, 3.8 7.5 C 4.5 3.5, 8 1.5, 12 1.5 Z" fill="url(#b_' + uid + ')" stroke="#FFFFFF" stroke-width="0.8" stroke-opacity="0.7"/>' +
          '<path d="M 2.2 14.5 C 0.8 14.2, 0.8 16.5, 2.4 16.8 Z" fill="' + s.base + '" stroke="#1E293B" stroke-width="0.5"/>' +
          '<path d="M 21.8 14.5 C 23.2 14.2, 23.2 16.5, 21.6 16.8 Z" fill="' + s.base + '" stroke="#1E293B" stroke-width="0.5"/>' +
          '<path d="M 7 5 C 9 8.5, 8.5 11.5, 7.5 12.5" stroke="rgba(255,255,255,0.45)" stroke-width="0.6" stroke-linecap="round"/>' +
          '<path d="M 17 5 C 15 8.5, 15.5 11.5, 16.5 12.5" stroke="rgba(255,255,255,0.45)" stroke-width="0.6" stroke-linecap="round"/>' +
          '<path d="M 5.8 13.5 C 8.5 12.2, 15.5 12.2, 18.2 13.5 L 17 19 C 14.5 18, 9.5 18, 7 19 Z" fill="url(#g_' + uid + ')" stroke="rgba(0,0,0,0.5)" stroke-width="0.5"/>' +
          '<path d="M 7 19 C 9.5 18, 14.5 18, 17 19 L 16.8 28.5 C 14.5 29.2, 9.5 29.2, 7.2 28.5 Z" fill="url(#r_' + uid + ')" stroke="rgba(255,255,255,0.3)" stroke-width="0.5"/>' +
          '<rect x="8.5" y="20.5" width="7" height="6.5" rx="1.5" fill="#0F172A" opacity="0.65"/>' +
          '<path d="M 9.5 21 L 14.5 21" stroke="rgba(255,255,255,0.4)" stroke-width="0.5"/>' +
          '<path d="M 7.2 28.8 C 9.5 29.4, 14.5 29.4, 16.8 28.8 L 17.8 34 C 15 35, 9 35, 6.2 34 Z" fill="url(#g_' + uid + ')" stroke="rgba(0,0,0,0.5)" stroke-width="0.5"/>' +
          '<path d="M 6.8 38 C 10 39, 14 39, 17.2 38" stroke="rgba(0,0,0,0.3)" stroke-width="0.8" stroke-linecap="round"/>' +
          '<path d="M 4.8 4.2 C 5.5 3.5, 7.2 3.8, 7 5.5 C 6.8 6.5, 5.2 6.2, 4.8 5.2 Z" fill="' + (isMoving ? '#FEF08A' : '#E2E8F0') + '" stroke="#FFFFFF" stroke-width="0.4"/>' +
          '<path d="M 19.2 4.2 C 18.5 3.5, 16.8 3.8, 17 5.5 C 17.2 6.5, 18.8 6.2, 19.2 5.2 Z" fill="' + (isMoving ? '#FEF08A' : '#E2E8F0') + '" stroke="#FFFFFF" stroke-width="0.4"/>' +
          '<path d="M 4.8 41.5 C 6 42.5, 7.5 42.2, 7.5 43.2 L 5 43.2 C 4.5 42.8, 4.5 42, 4.8 41.5 Z" fill="#EF4444"/>' +
          '<path d="M 19.2 41.5 C 18 42.5, 16.5 42.2, 16.5 43.2 L 19 43.2 C 19.5 42.8, 19.5 42, 19.2 41.5 Z" fill="#EF4444"/>' +
        '</g>' +
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
          getVehicleSvg(m.category, m.color, isMoving, m.id) +
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
              getVehicleSvg('car', '#2563EB', true, 'playback') +
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
