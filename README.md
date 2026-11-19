# GPS Track - Giant Eye Tech Fleet Mobile App

A modern, cross-platform mobile application (iOS & Android) built with **Expo SDK 58 (React Native + TypeScript)** for **Giant Eye Tech**, powered by **Traccar GPS Tracking Server**.

---

## ✨ Features

- **Multi-Server & Token/Password Login**: Connect to any self-hosted Traccar instance or the official Traccar demo server via credentials or API user tokens.
- **Real-Time Live Tracking (WebSocket)**: Connects to `/api/socket` for instant position streaming, device online/offline transitions, and alarms without polling.
- **Interactive Map (No API Key Required)**:
  - Powered by Leaflet & OpenStreetMap (supports Street, Satellite Imagery, and Dark map layers).
  - Vehicle markers rotate dynamically based on GPS heading (`course`) with speed badges.
  - Follow-vehicle mode and fit-all-fleet zoom.
- **Fleet Dashboard**:
  - Live status filter pills (`All`, `Moving`, `Idle`, `Stopped`, `Offline`).
  - Search by vehicle name or tracker IMEI / Unique ID.
  - Ignition status, speed indicator, battery level, address geocoding.
- **Historical Route Replay / Playback**:
  - Date & time filtering (Today, Yesterday, Last 24 hours, Custom).
  - Animated playback player with play/pause, scrub slider, and speed control (`1x`, `2x`, `5x`, `10x`).
- **Remote Commands**:
  - Dispatch immobilizer commands (`engineStop`, `engineResume`), force GPS fix (`positionSingle`), arm/disarm alarms, and custom GPRS commands.
- **Alerts & Alarms Feed**:
  - Overspeed warnings, geofence enter/exit, ignition on/off, and SOS shock alarms with direct link to map.
- **Telemetry & Diagnostics**:
  - Detailed sensor readouts: Odometer, engine running hours, GPS satellites, GSM signal (RSSI), battery voltage, and raw GPS fix timestamps.

---

## 🚀 Quick Start

### 1. Start Development Server
```bash
npx expo start
```

- Scan the QR code with the **Expo Go** app on your iPhone or Android phone.
- Press `a` to open on an Android emulator or `w` to preview on Web.

### 2. Connect to Traccar
1. Enter your Traccar Server URL (e.g. `http://your-server-ip:8082` or `https://gps.yourdomain.com`).
2. Log in with your Traccar account email and password, or use your Traccar User Token.
3. Tap **"Connect to Traccar"**!

*(Tip: You can also tap "Fill Official Demo Server Details" on the login screen to test immediately).*

---

## 📁 Project Structure

```
├── src/
│   ├── app/                    # Expo Router route screens
│   │   ├── _layout.tsx         # Root layout & providers
│   │   ├── (auth)/
│   │   │   └── login.tsx       # Server URL & login screen
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx     # Tab navigation bar
│   │   │   ├── index.tsx       # Fleet overview & search
│   │   │   ├── map.tsx         # Fullscreen real-time tracking map
│   │   │   ├── events.tsx      # Alerts & alarms feed
│   │   │   └── settings.tsx    # Connection status & units preferences
│   │   ├── device/
│   │   │   └── [id].tsx        # Deep telemetry & vehicle diagnostics
│   │   └── playback/
│   │       └── [id].tsx        # Route replay player & trajectory
│   ├── components/             # Reusable UI components
│   │   ├── MapViewer.tsx       # Leaflet map WebView component
│   │   ├── DeviceCard.tsx      # Fleet list item card
│   │   ├── DeviceBottomSheet.tsx # Floating vehicle sheet on map
│   │   ├── SendCommandModal.tsx# Remote command dispatch dialog
│   │   └── PlaybackControls.tsx# History player controller
│   ├── context/                # React state providers
│   │   ├── AuthContext.tsx     # Session & server URL management
│   │   └── TraccarContext.tsx  # Fleet devices, positions, and live socket state
│   ├── services/
│   │   ├── api.ts              # Traccar REST API client
│   │   └── socket.ts           # Traccar WebSocket client
│   ├── types/
│   │   └── traccar.ts          # TypeScript models
│   └── utils/
│       └── formatters.ts       # Speed, distance, status, & time formatters
├── app.json
├── package.json
└── tsconfig.json
```

