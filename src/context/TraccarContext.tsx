import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Device, Position, Event, DeviceStatusFilter, SocketMessage } from '../types/traccar';
import { traccarApi } from '../services/api';
import { traccarSocket } from '../services/socket';
import { useAuth } from './AuthContext';
import { getDeviceOperationalStatus } from '../utils/formatters';
import { notificationService } from '../services/notifications';
import * as Notifications from 'expo-notifications';

interface TraccarContextType {
  devices: Device[];
  positions: Record<number, Position>; // deviceId -> latest Position
  events: Event[];
  selectedDeviceId: number | null;
  setSelectedDeviceId: (id: number | null) => void;
  socketConnected: boolean;
  filter: DeviceStatusFilter;
  setFilter: (filter: DeviceStatusFilter) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredDevices: Device[];
  refreshData: () => Promise<void>;
  speedUnit: 'kmh' | 'mph';
  setSpeedUnit: (unit: 'kmh' | 'mph') => void;
  stats: {
    total: number;
    moving: number;
    idle: number;
    stopped: number;
    offline: number;
  };
}

const TraccarContext = createContext<TraccarContextType>({} as TraccarContextType);

export function TraccarProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();

  const [devices, setDevices] = useState<Device[]>([]);
  const [positions, setPositions] = useState<Record<number, Position>>({});
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [filter, setFilter] = useState<DeviceStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [speedUnit, setSpeedUnit] = useState<'kmh' | 'mph'>('kmh');

  // Register push notifications when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      notificationService.registerForPushNotifications(user);
    }
  }, [isAuthenticated, user]);

  // Push notification click listener
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const deviceId = response.notification.request.content.data?.deviceId;
      if (deviceId) {
        setSelectedDeviceId(Number(deviceId));
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Initial load when authenticated
  const refreshData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [fetchedDevices, fetchedPositions] = await Promise.all([
        traccarApi.getDevices(),
        traccarApi.getPositions(),
      ]);

      setDevices(fetchedDevices);

      // Build positions dictionary by deviceId
      const posMap: Record<number, Position> = {};
      fetchedPositions.forEach((pos) => {
        posMap[pos.deviceId] = pos;
      });
      setPositions(posMap);
    } catch (err) {
      console.warn('Failed to refresh Traccar data:', err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshData();
    } else {
      setDevices([]);
      setPositions({});
      setEvents([]);
      setSelectedDeviceId(null);
      seenEventsRef.current.clear();
      isInitialEventsLoadedRef.current = false;
    }
  }, [isAuthenticated, refreshData]);

  const seenEventsRef = React.useRef<Set<number>>(new Set());
  const isInitialEventsLoadedRef = React.useRef<boolean>(false);

  // Listen to WebSocket updates
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubStatus = traccarSocket.onStatusChange((status) => {
      setSocketConnected(status);
    });

    const unsubMsg = traccarSocket.onMessage((msg: SocketMessage) => {
      // Handle updated devices
      if (msg.devices && msg.devices.length > 0) {
        setDevices((prev) => {
          const map = new Map(prev.map((d) => [d.id, d]));
          msg.devices!.forEach((d) => map.set(d.id, { ...map.get(d.id), ...d }));
          return Array.from(map.values());
        });
      }

      // Handle updated positions
      if (msg.positions && msg.positions.length > 0) {
        setPositions((prev) => {
          const updated = { ...prev };
          msg.positions!.forEach((pos) => {
            updated[pos.deviceId] = pos;
          });
          return updated;
        });
      }

      // Handle new events
      if (msg.events && msg.events.length > 0) {
        setEvents((prev) => [...msg.events!, ...prev].slice(0, 100));

        msg.events.forEach((ev) => {
          if (!seenEventsRef.current.has(ev.id)) {
            seenEventsRef.current.add(ev.id);
            setDevices((currentDevs) => {
              const targetDev = currentDevs.find((d) => d.id === ev.deviceId);
              notificationService.notifyEvent(ev, targetDev?.name || `Vehicle #${ev.deviceId}`);
              return currentDevs;
            });
          }
        });
      }
    });

    return () => {
      unsubStatus();
      unsubMsg();
    };
  }, [isAuthenticated]);

  // High-Frequency Real-Time Poller (Runs every 3.5s for live positions & events)
  useEffect(() => {
    if (!isAuthenticated) return;

    let isPolling = false;
    const interval = setInterval(async () => {
      if (isPolling) return;
      isPolling = true;

      try {
        // 1. Live Positions Sync
        const latestPositions = await traccarApi.getPositions();
        if (latestPositions && latestPositions.length > 0) {
          setPositions((prev) => {
            const updated = { ...prev };
            let changed = false;
            latestPositions.forEach((pos) => {
              const old = prev[pos.deviceId];
              if (
                !old ||
                old.latitude !== pos.latitude ||
                old.longitude !== pos.longitude ||
                old.speed !== pos.speed ||
                old.course !== pos.course ||
                old.fixTime !== pos.fixTime
              ) {
                updated[pos.deviceId] = pos;
                changed = true;
              }
            });
            return changed ? updated : prev;
          });
        }

        // 2. Real-Time Events & Geofence Alarms Poller (past 1 hour to now)
        const now = new Date();
        const past10Min = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
        const recentEvents = await traccarApi.getEvents(undefined, past10Min, now.toISOString());

        if (recentEvents && recentEvents.length > 0) {
          if (!isInitialEventsLoadedRef.current) {
            // First time loading: record existing events so we don't spam old history
            recentEvents.forEach((ev) => seenEventsRef.current.add(ev.id));
            setEvents(recentEvents.slice(0, 100));
            isInitialEventsLoadedRef.current = true;
          } else {
            // Subsequent polls: only trigger push banner/sound for newly reported events
            recentEvents.forEach((ev) => {
              if (!seenEventsRef.current.has(ev.id)) {
                seenEventsRef.current.add(ev.id);
                setEvents((prev) => [ev, ...prev].slice(0, 100));

                setDevices((currentDevs) => {
                  const targetDev = currentDevs.find((d) => d.id === ev.deviceId);
                  notificationService.notifyEvent(ev, targetDev?.name || `Vehicle #${ev.deviceId}`);
                  return currentDevs;
                });
              }
            });
          }
        } else {
          isInitialEventsLoadedRef.current = true;
        }
      } catch (e) {
        // Silently continue polling on next tick
      } finally {
        isPolling = false;
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Compute fleet status counts
  const stats = React.useMemo(() => {
    let moving = 0;
    let idle = 0;
    let stopped = 0;
    let offline = 0;

    devices.forEach((dev) => {
      const pos = positions[dev.id];
      const status = getDeviceOperationalStatus(dev, pos);
      if (status === 'moving') moving++;
      else if (status === 'idle') idle++;
      else if (status === 'stopped') stopped++;
      else offline++;
    });

    return {
      total: devices.length,
      moving,
      idle,
      stopped,
      offline,
    };
  }, [devices, positions]);

  // Filtered devices list based on search and status chip
  const filteredDevices = React.useMemo(() => {
    return devices.filter((dev) => {
      const pos = positions[dev.id];
      const status = getDeviceOperationalStatus(dev, pos);

      if (filter !== 'all' && status !== filter) {
        return false;
      }

      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase();
        const matchName = dev.name.toLowerCase().includes(query);
        const matchId = dev.uniqueId.toLowerCase().includes(query);
        return matchName || matchId;
      }

      return true;
    });
  }, [devices, positions, filter, searchQuery]);

  return (
    <TraccarContext.Provider
      value={{
        devices,
        positions,
        events,
        selectedDeviceId,
        setSelectedDeviceId,
        socketConnected,
        filter,
        setFilter,
        searchQuery,
        setSearchQuery,
        filteredDevices,
        refreshData,
        speedUnit,
        setSpeedUnit,
        stats,
      }}
    >
      {children}
    </TraccarContext.Provider>
  );
}

export function useTraccar() {
  const context = useContext(TraccarContext);
  if (!context) {
    throw new Error('useTraccar must be used within a TraccarProvider');
  }
  return context;
}

