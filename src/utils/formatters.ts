import { Device, Position } from '../types/traccar';

export const KNOTS_TO_KMH = 1.852;
export const KNOTS_TO_MPH = 1.15078;

export function formatSpeed(speedInKnots?: number, unit: 'kmh' | 'mph' = 'kmh'): string {
  if (speedInKnots === undefined || speedInKnots === null || speedInKnots < 0.5) {
    return `0 ${unit === 'kmh' ? 'km/h' : 'mph'}`;
  }
  const factor = unit === 'kmh' ? KNOTS_TO_KMH : KNOTS_TO_MPH;
  const speed = Math.round(speedInKnots * factor);
  return `${speed} ${unit === 'kmh' ? 'km/h' : 'mph'}`;
}

export function formatDistance(meters?: number, unit: 'km' | 'mi' = 'km'): string {
  if (!meters) return `0 ${unit}`;
  if (unit === 'km') {
    const km = (meters / 1000).toFixed(1);
    return `${km} km`;
  }
  const mi = (meters / 1609.34).toFixed(1);
  return `${mi} mi`;
}

export function getHeadingDirection(course: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((course % 360) / 45)) % 8;
  return directions[index];
}

export function getDeviceOperationalStatus(
  device: Device,
  position?: Position
): 'moving' | 'idle' | 'stopped' | 'offline' {
  if (device.status === 'offline') {
    return 'offline';
  }

  if (!position) {
    return 'offline';
  }

  // Check how long ago position fix was received
  const fixTime = new Date(position.fixTime).getTime();
  const now = Date.now();
  if (now - fixTime > 24 * 60 * 60 * 1000) {
    return 'offline';
  }

  const speedKmh = (position.speed || 0) * KNOTS_TO_KMH;
  const ignition = position.attributes?.ignition;

  if (ignition === true && speedKmh > 3) {
    return 'moving';
  } else if (ignition === true && speedKmh <= 3) {
    return 'idle';
  } else if (ignition === false) {
    return 'stopped';
  }

  // Fallback based on speed
  if (speedKmh > 3) return 'moving';
  return 'stopped';
}

export function getStatusColor(status: 'moving' | 'idle' | 'stopped' | 'offline'): string {
  switch (status) {
    case 'moving':
      return '#10B981'; // Green
    case 'idle':
      return '#F59E0B'; // Amber
    case 'stopped':
      return '#EF4444'; // Red
    case 'offline':
    default:
      return '#6B7280'; // Gray
  }
}

export function getStatusLabel(status: 'moving' | 'idle' | 'stopped' | 'offline'): string {
  switch (status) {
    case 'moving':
      return 'Moving';
    case 'idle':
      return 'Idle';
    case 'stopped':
      return 'Stopped';
    case 'offline':
      return 'Offline';
  }
}

export function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSec < 15) return 'Just now';
  if (diffInSec < 60) return `${diffInSec}s ago`;
  const diffInMin = Math.floor(diffInSec / 60);
  if (diffInMin < 60) return `${diffInMin}m ago`;
  const diffInHours = Math.floor(diffInMin / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}

export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

export function estimateDriveTimeMinutes(distanceKm: number): number {
  if (distanceKm <= 0) return 0;
  return Math.max(1, Math.round((distanceKm / 35) * 60));
}


