export interface User {
  id: number;
  name: string;
  email: string;
  readonly?: boolean;
  administrator?: boolean;
  map?: string;
  latitude?: number;
  longitude?: number;
  zoom?: number;
  attributes?: Record<string, any>;
}

export interface Device {
  id: number;
  name: string;
  uniqueId: string;
  status: 'online' | 'offline' | 'unknown';
  disabled?: boolean;
  lastUpdate?: string;
  positionId?: number;
  groupId?: number;
  phone?: string;
  model?: string;
  contact?: string;
  category?: 'car' | 'truck' | 'bus' | 'motorcycle' | 'bicycle' | 'person' | 'boat' | 'van' | string;
  attributes?: {
    speedLimit?: number;
    fuelCapacity?: number;
    [key: string]: any;
  };
}

export interface Position {
  id: number;
  deviceId: number;
  protocol?: string;
  serverTime?: string;
  deviceTime?: string;
  fixTime: string;
  outdated?: boolean;
  valid: boolean;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed: number; // in knots by Traccar API, converted to km/h or mph
  course: number; // heading 0-360 degrees
  address?: string;
  accuracy?: number;
  network?: any;
  geofenceIds?: number[];
  attributes: {
    ignition?: boolean;
    motion?: boolean;
    batteryLevel?: number;
    battery?: number;
    power?: number;
    charge?: boolean;
    alarm?: string;
    distance?: number;
    totalDistance?: number;
    hours?: number;
    blocked?: boolean;
    sat?: number;
    rssi?: number;
    [key: string]: any;
  };
}

export interface Event {
  id: number;
  type: string;
  serverTime: string;
  deviceId: number;
  positionId?: number;
  geofenceId?: number;
  maintenanceId?: number;
  attributes?: Record<string, any>;
}

export interface Geofence {
  id: number;
  name: string;
  description?: string;
  area: string; // WKT format: e.g. CIRCLE (lat lon, radius) or POLYGON (...)
  attributes?: Record<string, any>;
}

export interface ServerInfo {
  version: string;
  registration?: boolean;
  readonly?: boolean;
  map?: string;
  bingKey?: string;
  mapUrl?: string;
  latitude?: number;
  longitude?: number;
  zoom?: number;
}

export interface Command {
  id?: number;
  deviceId: number;
  type: string;
  textChannel?: boolean;
  description?: string;
  attributes?: Record<string, any>;
}

export interface SocketMessage {
  devices?: Device[];
  positions?: Position[];
  events?: Event[];
}

export type DeviceStatusFilter = 'all' | 'moving' | 'idle' | 'stopped' | 'offline';

