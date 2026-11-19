import { Platform } from 'react-native';
import { SocketMessage } from '../types/traccar';

type MessageHandler = (data: SocketMessage) => void;
type StatusHandler = (connected: boolean) => void;

class TraccarSocketService {
  private ws: WebSocket | null = null;
  private messageListeners: Set<MessageHandler> = new Set();
  private statusListeners: Set<StatusHandler> = new Set();
  private reconnectTimeout: any = null;
  private isIntentionalClose: boolean = false;
  private serverUrl: string = '';
  private sessionCookie: string | null = null;
  private authToken: string | null = null;
  private retryDelay: number = 3000;

  public connect(serverUrl: string, sessionCookie?: string | null, authToken?: string | null) {
    this.serverUrl = serverUrl;
    this.sessionCookie = sessionCookie || null;
    this.authToken = authToken || null;
    this.isIntentionalClose = false;

    if (this.ws) {
      this.disconnect();
    }

    try {
      if (
        Platform.OS === 'web' &&
        typeof window !== 'undefined' &&
        window.location.protocol === 'https:' &&
        serverUrl.startsWith('http://')
      ) {
        // Unencrypted WS is blocked on HTTPS pages by browser security policy.
        // Fall back gracefully to high-frequency 3.5s HTTP poller
        this.notifyStatus(true);
        return;
      }

      let wsUrl = serverUrl.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://');
      if (wsUrl.endsWith('/')) {
        wsUrl = wsUrl.slice(0, -1);
      }
      wsUrl = `${wsUrl}/api/socket`;

      if (this.authToken && !this.authToken.startsWith('Basic ')) {
        wsUrl = `${wsUrl}?token=${encodeURIComponent(this.authToken)}`;
      }

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.retryDelay = 3000;
        this.notifyStatus(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const data: SocketMessage = JSON.parse(event.data);
          this.notifyMessage(data);
        } catch (err) {
          console.warn('[Traccar WS] parse error:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[Traccar WS] error:', err);
      };

      this.ws.onclose = () => {
        this.notifyStatus(false);
        if (!this.isIntentionalClose) {
          this.scheduleReconnect();
        }
      };
    } catch (e) {
      console.warn('[Traccar WS] connection failed:', e);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      if (!this.isIntentionalClose && this.serverUrl) {
        this.connect(this.serverUrl, this.sessionCookie, this.authToken);
      }
    }, this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 1.5, 30000); // Backoff up to 30s
  }

  public disconnect() {
    this.isIntentionalClose = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.notifyStatus(false);
  }

  public onMessage(handler: MessageHandler): () => void {
    this.messageListeners.add(handler);
    return () => {
      this.messageListeners.delete(handler);
    };
  }

  public onStatusChange(handler: StatusHandler): () => void {
    this.statusListeners.add(handler);
    return () => {
      this.statusListeners.delete(handler);
    };
  }

  private notifyMessage(data: SocketMessage) {
    this.messageListeners.forEach((fn) => {
      try {
        fn(data);
      } catch (err) {
        console.error('[Traccar WS] listener error:', err);
      }
    });
  }

  private notifyStatus(connected: boolean) {
    this.statusListeners.forEach((fn) => {
      try {
        fn(connected);
      } catch (err) {
        console.error('[Traccar WS] status listener error:', err);
      }
    });
  }
}

export const traccarSocket = new TraccarSocketService();

