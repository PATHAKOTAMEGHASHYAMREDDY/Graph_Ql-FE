import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../environments/environment';

export interface MarksUpdate {
  id: number;
  name: string;
  email: string;
  english: number;
  tamil: number;
  maths: number;
  total: number;
  englishStatus: string;
  tamilStatus: string;
  mathsStatus: string;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService implements OnDestroy {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000; // 3 seconds
  private reconnectTimer: any = null;
  private pingTimer: any = null;

  // Observable for connection status
  private _connected$ = new BehaviorSubject<boolean>(false);
  readonly connected$: Observable<boolean> = this._connected$.asObservable();

  // Observable for marks updates
  private _marksUpdate$ = new BehaviorSubject<MarksUpdate | null>(null);
  readonly marksUpdate$: Observable<MarksUpdate | null> = this._marksUpdate$.asObservable();

  constructor() {}

  /**
   * Connect to WebSocket server with authentication token
   */
  connect(token: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('🔌 WebSocket already connected');
      return;
    }

    const wsUrl = environment.apiUrl.replace('http://', 'ws://').replace('https://', 'wss://').replace('/graphql', '/ws');
    
    console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        this._connected$.next(true);
        this.reconnectAttempts = 0;

        // Send authentication
        this.send({ type: 'auth', token });

        // Start ping/pong keep-alive
        this.startPing();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('❌ Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        this._connected$.next(false);
        this.stopPing();

        // Attempt to reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`🔄 Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          
          this.reconnectTimer = setTimeout(() => {
            this.connect(token);
          }, this.reconnectDelay);
        } else {
          console.log('❌ Max reconnection attempts reached');
        }
      };

    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: any): void {
    console.log('📨 WebSocket message:', message);

    switch (message.type) {
      case 'auth_success':
        console.log('✅ WebSocket authenticated');
        break;

      case 'marks_updated':
        console.log('📊 Marks updated:', message.data);
        this._marksUpdate$.next(message.data);
        break;

      case 'pong':
        // Keep-alive response
        break;

      case 'error':
        console.error('❌ WebSocket error:', message.message);
        break;

      default:
        console.log('ℹ️  Unknown message type:', message.type);
    }
  }

  /**
   * Send message to WebSocket server
   */
  private send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('⚠️  WebSocket not connected, cannot send message');
    }
  }

  /**
   * Start ping/pong keep-alive
   */
  private startPing(): void {
    this.pingTimer = setInterval(() => {
      this.send({ type: 'ping' });
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Stop ping/pong keep-alive
   */
  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopPing();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this._connected$.next(false);
    console.log('🔌 WebSocket disconnected manually');
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  ngOnDestroy(): void {
    this.disconnect();
    this._connected$.complete();
    this._marksUpdate$.complete();
  }
}
