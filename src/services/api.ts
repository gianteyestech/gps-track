import { Platform } from 'react-native';
import { Device, Position, Event, Geofence, ServerInfo, User, Command } from '../types/traccar';
import { APP_CONFIG } from '../constants/config';

class TraccarApiService {
  private serverUrl: string = APP_CONFIG.SERVER_URL;
  private authToken: string | null = null;
  private sessionCookie: string | null = null;

  public setServerUrl(url: string) {
    let cleaned = url.trim();
    if (cleaned.endsWith('/')) {
      cleaned = cleaned.slice(0, -1);
    }
    if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
      cleaned = `http://${cleaned}`;
    }
    this.serverUrl = cleaned;
  }

  public getServerUrl(): string {
    return this.serverUrl;
  }

  public setAuthToken(token: string | null) {
    this.authToken = token;
  }

  public setSessionCookie(cookie: string | null) {
    this.sessionCookie = cookie;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (this.sessionCookie) {
      headers['Cookie'] = this.sessionCookie;
    }

    if (this.authToken) {
      if (this.authToken.startsWith('Basic ')) {
        headers['Authorization'] = this.authToken;
      } else {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }
    }

    return headers;
  }

  public resolveUrl(endpoint: string): string {
    let url = `${this.serverUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    // On Web HTTPS (e.g. Vercel), route through Vercel proxy to avoid browser Mixed Content block
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      window.location.protocol === 'https:' &&
      this.serverUrl.startsWith('http://')
    ) {
      const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      url = cleanEndpoint.startsWith('/api')
        ? cleanEndpoint.replace('/api', '/api/proxy')
        : `/api/proxy${cleanEndpoint}`;
    }

    return url;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = this.resolveUrl(endpoint);
    
    const headers = {
      ...this.getHeaders(),
      ...(options.headers as Record<string, string> || {}),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Capture JSESSIONID cookie if returned in headers
    const rawSetCookie = response.headers.get('set-cookie');
    if (rawSetCookie) {
      const match = rawSetCookie.match(/JSESSIONID=([^;]+)/);
      if (match) {
        this.sessionCookie = `JSESSIONID=${match[1]}`;
      }
    }

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errJson = await response.json();
        if (errJson && errJson.message) {
          errorMessage = errJson.message;
        }
      } catch {
        const errText = await response.text();
        if (errText) errorMessage = errText;
      }
      throw new Error(errorMessage);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  // Server Info
  public async getServerInfo(): Promise<ServerInfo> {
    return this.request<ServerInfo>('/api/server');
  }

  // Authentication
  public async loginWithCredentials(email: string, password: string): Promise<User> {
    const body = new URLSearchParams();
    body.append('email', email.trim());
    body.append('password', password);

    // Prepare Basic Auth token for API requests after login
    let basicToken: string | null = null;
    try {
      basicToken = 'Basic ' + btoa(`${email.trim()}:${password}`);
    } catch {}

    const response = await fetch(this.resolveUrl('/api/session'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    const rawSetCookie = response.headers.get('set-cookie');
    if (rawSetCookie) {
      const match = rawSetCookie.match(/JSESSIONID=([^;]+)/);
      if (match) {
        this.sessionCookie = `JSESSIONID=${match[1]}`;
      }
    }

    if (!response.ok) {
      this.authToken = null;
      let msg = 'Invalid credentials or server unavailable';
      try {
        const text = await response.text();
        if (
          text.includes('NullPointerException') ||
          text.includes('LoginResult') ||
          text.includes('LoginService') ||
          response.status === 400 ||
          response.status === 401
        ) {
          msg = 'Invalid email/username or password. Please check your Traccar credentials.';
        } else if (text) {
          try {
            const errObj = JSON.parse(text);
            if (errObj && errObj.message) msg = errObj.message;
          } catch {
            msg = text;
          }
        }
      } catch {}
      throw new Error(msg);
    }

    this.authToken = basicToken;
    return response.json();
  }

  public async loginWithToken(token: string): Promise<User> {
    this.setAuthToken(token);
    return this.request<User>(`/api/session?token=${encodeURIComponent(token)}`);
  }

  public async getSession(): Promise<User> {
    return this.request<User>('/api/session');
  }

  public async getSessionToken(): Promise<string> {
    try {
      const response = await fetch(this.resolveUrl('/api/session/token'), {
        method: 'POST',
        headers: this.getHeaders(),
      });
      if (response.ok) {
        const text = await response.text();
        return text.trim();
      }
    } catch {}
    return '';
  }

  public async logout(): Promise<void> {
    try {
      await this.request('/api/session', { method: 'DELETE' });
    } finally {
      this.authToken = null;
      this.sessionCookie = null;
    }
  }

  // Devices
  public async getDevices(): Promise<Device[]> {
    return this.request<Device[]>('/api/devices');
  }

  // Positions
  public async getPositions(deviceId?: number): Promise<Position[]> {
    const query = deviceId ? `?deviceId=${deviceId}` : '';
    return this.request<Position[]>(`/api/positions${query}`);
  }

  // History Route Report
  public async getRoute(deviceId: number, from: string, to: string): Promise<Position[]> {
    const params = new URLSearchParams({
      deviceId: deviceId.toString(),
      from,
      to,
    });
    return this.request<Position[]>(`/api/reports/route?${params.toString()}`);
  }

  // Events
  public async getEvents(deviceId?: number, from?: string, to?: string): Promise<Event[]> {
    const params = new URLSearchParams();
    if (deviceId) params.append('deviceId', deviceId.toString());
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    return this.request<Event[]>(`/api/reports/events?${params.toString()}`);
  }

  // Summary Report (Total distance, engine hours, max speed, average speed)
  public async getSummaryReport(deviceId: number, from: string, to: string): Promise<any[]> {
    const params = new URLSearchParams({
      deviceId: deviceId.toString(),
      from,
      to,
    });
    return this.request<any[]>(`/api/reports/summary?${params.toString()}`);
  }

  // Trips Report (Individual journeys with start/end address and distance)
  public async getTripsReport(deviceId: number, from: string, to: string): Promise<any[]> {
    const params = new URLSearchParams({
      deviceId: deviceId.toString(),
      from,
      to,
    });
    return this.request<any[]>(`/api/reports/trips?${params.toString()}`);
  }

  // Stops Report (Parking duration and locations)
  public async getStopsReport(deviceId: number, from: string, to: string): Promise<any[]> {
    const params = new URLSearchParams({
      deviceId: deviceId.toString(),
      from,
      to,
    });
    return this.request<any[]>(`/api/reports/stops?${params.toString()}`);
  }

  // Geofences
  public async getGeofences(): Promise<Geofence[]> {
    return this.request<Geofence[]>('/api/geofences');
  }

  // Remote Commands
  public async sendCommand(command: Command): Promise<any> {
    return this.request('/api/commands/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });
  }

  // Create Device (Add Tracker)
  public async createDevice(device: Partial<Device>): Promise<Device> {
    return this.request<Device>('/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(device),
    });
  }

  // Update Device
  public async updateDevice(id: number, device: Partial<Device>): Promise<Device> {
    return this.request<Device>(`/api/devices/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(device),
    });
  }

  // Update User (e.g. Change Password)
  public async updateUser(user: Partial<User> & { id: number; password?: string }): Promise<User> {
    return this.request<User>(`/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
  }

  // Create Geofence
  public async createGeofence(geofence: Partial<Geofence>): Promise<Geofence> {
    return this.request<Geofence>('/api/geofences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geofence),
    });
  }

  // Delete Geofence
  public async deleteGeofence(id: number): Promise<void> {
    return this.request<void>(`/api/geofences/${id}`, {
      method: 'DELETE',
    });
  }
}

export const traccarApi = new TraccarApiService();

