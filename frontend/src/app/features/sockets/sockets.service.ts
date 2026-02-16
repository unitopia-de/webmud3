import { EventEmitter, inject, Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Manager, Socket } from 'socket.io-client';

import { ServerConfigService } from '../../features/serverconfig/server-config.service';
import { GmcpService } from '../../features/gmcp/gmcp.service';
import { SecureString } from '@webmud3/frontend/shared/types/secure-string';
import { isSecureString } from '@webmud3/frontend/shared/utils/is-secure-string';
import { OutputHistoryService } from '@webmud3/frontend/shared/services/output-history.service';

import type {
  ClientToServerEvents,
  GmcpSupport,
  ServerToClientEvents,
  LinemodeState,
} from '@webmud3/shared';

type MudOutputEventArgs = {
  data: string;
};

@Injectable({
  providedIn: 'root',
})
export class SocketsService {
  private readonly outputHistoryService = inject(OutputHistoryService);
  private readonly gmcpService = inject(GmcpService);
  private readonly manager: Manager;
  private readonly socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  private readonly connectedToServer = new BehaviorSubject<boolean>(false);
  private readonly connectedToMud = new BehaviorSubject<boolean>(false);
  private readonly inputQueue: string[] = [];
  private isReconnecting = false;
  private sessionToken: string;

  public onMudConnect = new EventEmitter<boolean>(); // Emits isNewConnection
  public onMudDisconnect = new EventEmitter();
  public onMudOutput = new EventEmitter<MudOutputEventArgs>();
  public onSetEchoMode = new EventEmitter<boolean>();
  public onSetLinemode = new EventEmitter<LinemodeState>();

  public readonly connectedToServer$ = this.connectedToServer.asObservable();
  public readonly connectedToMud$ = this.connectedToMud.asObservable();

  public constructor(serverConfigService: ServerConfigService) {
    const socketUrl = serverConfigService.getBackendUrl();
    const socketNamespace = serverConfigService.getSocketNamespace();

    // Initialize or retrieve persistent session token
    this.sessionToken = this.initializeSessionToken();

    console.log('[Sockets] Socket Service init socket', {
      socketUrl,
      socketNamespace,
      sessionToken: this.sessionToken,
    });

    this.manager = new Manager(socketUrl, {
      path: socketNamespace,
      transports: ['websocket'],
      reconnectionAttempts: Infinity,
      reconnection: true,
    });

    this.manager.on('error', (error: Error) => {
      this.handleError(error);
    });

    this.manager.on('reconnect', (attempt: number) => {
      this.handleReconnect(attempt);
    });

    this.manager.on('reconnect_attempt', (attempt: number) => {
      this.handleReconnectAttempt(attempt);
    });

    this.manager.on('reconnect_error', (error: Error) => {
      this.handleReconnectError(error);
    });

    this.manager.on('reconnect_failed', () => {
      this.handleReconnectFailed();
    });

    this.manager.on('close', () => {
      this.handleClose();
    });

    this.manager.on('ping', () => {
      this.handlePing();
    });

    this.socket = this.manager.socket('/', {
      auth: {
        sessionToken: this.sessionToken,
      },
    });

    this.socket.on('connect', () => {
      this.handleConnect();
    });

    this.socket.on('disconnect', (reason: string) => {
      this.handleDisconnect(reason);
    });

    this.socket.on(
      'mudConnected',
      (isNewConnection: boolean, sessionToken: string) => {
        this.handleMudConnect(isNewConnection, sessionToken);
      },
    );

    this.socket.on('mudDisconnected', () => {
      this.handleMudDisconnect();
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.socket as unknown as any).on(
      'mudOutput',
      (output: string, seq: number) => {
        this.handleMudOutput(output, seq);
      },
    );

    // Optional batch replay on reconnect
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.socket as unknown as any).on(
      'mudOutputBatch',
      (entries: Array<{ data: string; seq: number }>) => {
        this.handleMudOutputBatch(entries);
      },
    );

    this.socket.on('setEchoMode', (showEchos: boolean) => {
      this.handleSetEchoMode(showEchos);
    });

    this.socket.on('setLinemode', (state: LinemodeState) => {
      this.handleSetLinemode(state);
    });

    this.socket.on('requestTimingMark', (callback: () => void) => {
      this.handleTimingMark(callback);
    });

    this.socket.on(
      'mudGmcpIncoming',
      (module: string, message: string, data: unknown) => {
        this.handleGmcpIncoming(module, message, data);
      },
    );

    this.socket.on('mudGmcpStart', (gmcpSupport: GmcpSupport) => {
      this.handleGmcpStart(gmcpSupport);
    });

    // Wire up GmcpService's send function to emit via Socket.IO
    this.gmcpService.setSendFunction(
      (module: string, message: string, data: unknown) => {
        this.socket.emit('mudGmcpOutgoing', module, message, data);
      },
    );
  }

  public connectToMud(
    initialViewPort: { columns: number; rows: number },
    mudId?: string,
  ): void {
    console.log(
      `[Sockets] Sockets-Service: 'connectToMud' with sessionToken: ${this.sessionToken}, mudId: ${mudId ?? '(default)'}`,
    );
    this.socket.emit('mudConnect', initialViewPort, this.sessionToken, mudId);
  }

  public disconnectFromMud() {
    console.log(`[Sockets] Sockets-Service: 'disconnect'`);
    this.socket.emit('mudDisconnect');
  }

  public sendMessage(message: string | SecureString) {
    // Queue the message if disconnected or reconnecting
    if (!this.connectedToServer.value || this.isReconnecting) {
      const messageToQueue = !isSecureString(message) ? message : message.value;
      this.inputQueue.push(messageToQueue);
      console.log(
        `[Sockets] Sockets-Service: Message queued (${this.inputQueue.length} in queue)`,
      );
      return;
    }

    if (!isSecureString(message)) {
      console.log(`[Sockets] Sockets-Service: 'sendMessage'`, { message });
      this.socket.emit('mudInput', message);
    } else {
      this.socket.emit('mudInput', message.value);
    }
  }

  public updateViewportSize(columns: number, rows: number): void {
    console.log(`[Sockets] Sockets-Service: 'mudViewportSize'`, {
      columns,
      rows,
    });

    this.socket.emit('mudViewportSize', columns, rows);
  }

  /**
   * Sends a GMCP message to the MUD server via Socket.IO.
   * Prefer using GmcpService.sendOutgoing() instead for proper state checking.
   */
  public sendGmcp(module: string, message: string, data: unknown): void {
    console.log(
      `[Sockets] Sockets-Service: 'sendGmcp' ${module}.${message}`,
    );

    this.socket.emit('mudGmcpOutgoing', module, message, data);
  }

  private handleMudConnect = (
    isNewConnection: boolean,
    sessionToken: string,
  ) => {
    console.log(
      '[Sockets] Sockets-Service: mudConnected, isNewConnection:',
      isNewConnection,
      'sessionToken:',
      sessionToken,
    );

    // Update session token if received from server
    if (sessionToken) {
      this.sessionToken = sessionToken;
      this.saveSessionToken(sessionToken);
      this.socket.auth = { sessionToken };
    }

    // Don't clear history here - it would clear on every page reload
    // since isNewConnection=true even when just the socket-id changed
    // History is only cleared on explicit mudDisconnect

    this.connectedToMud.next(true);
    this.onMudConnect.emit(isNewConnection);
  };

  private handleMudDisconnect = () => {
    console.log(`[Sockets] Sockets-Service: received 'mudDisconnected'`);

    // Clear history when MUD connection is closed
    console.log('[Sockets] Clearing history after MUD disconnect');
    this.outputHistoryService.clearAll();

    // Reset GMCP state (dispose handlers, clear registry)
    this.gmcpService.reset();

    this.connectedToMud.next(false);

    this.onMudDisconnect.emit();
  };

  private handleMudOutput = (output: string, seq?: number) => {
    // Accept only if seq gating passes (or seq missing for compatibility)
    if (typeof seq === 'number') {
      const last = this.outputHistoryService.getLastSeqSeen(this.sessionToken);
      if (seq <= last) {
        // Old replay; drop silently
        return;
      }
      // Persist and emit
      this.outputHistoryService.appendServerEntry(
        this.sessionToken,
        output,
        seq,
      );
    }

    this.onMudOutput.emit({ data: output });

    if (this.inputQueue.length > 0) {
      this.flushInputQueue();
    }
  };

  private handleMudOutputBatch = (
    entries: Array<{ data: string; seq: number }>,
  ) => {
    // Process in order; persist and emit only new ones
    for (const { data, seq } of entries) {
      this.handleMudOutput(data, seq);
    }
  };

  private handleClose() {
    console.log('[Sockets] Sockets-Service: Close');

    this.connectedToMud.next(false);

    this.onMudConnect.emit();
  }

  private handleError = (error: Error) => {
    console.error('[Sockets] Sockets-Service: Error:', error);
  };

  private handleReconnect = (attempt: number) => {
    console.info('[Sockets] Sockets-Service: Reconnect:', attempt);
    this.isReconnecting = false;

    // Flush queued input after reconnection
    this.flushInputQueue();
  };

  private handleReconnectAttempt = (attempt: number) => {
    console.info('[Sockets] Sockets-Service: Reconnect Attempt:', attempt);
    this.isReconnecting = true;
  };

  private handleReconnectError = (error: Error) => {
    console.error('[Sockets] Sockets-Service: Reconnect Error:', error);
  };

  private handleReconnectFailed = () => {
    this.connectedToServer.next(false);

    console.error('[Sockets] Sockets-Service: Reconnect Failed');
  };

  private handlePing = () => {
    console.info('[Sockets] Sockets-Service: Ping');
  };

  private handleConnect = () => {
    this.connectedToServer.next(true);

    console.info('[Sockets] Sockets-Service: Socket Connected');
  };

  private handleDisconnect = (reason: string) => {
    this.connectedToServer.next(false);

    console.info('[Sockets] Sockets-Service: Socket Disconnected:', reason);
  };

  private handleSetEchoMode = (showEchos: boolean) => {
    console.info('[Sockets] Sockets-Service: Socket Set Echo Mode:', showEchos);

    this.onSetEchoMode.emit(showEchos);
  };

  private handleSetLinemode = (state: LinemodeState) => {
    console.info('[Sockets] Sockets-Service: Socket Set Linemode:', state);

    this.onSetLinemode.emit(state);
  };

  private handleTimingMark = (callback: () => void) => {
    console.info('[Sockets] Sockets-Service: Got and answer a Timing Mark');

    callback();
  };

  private handleGmcpIncoming = (
    module: string,
    message: string,
    data: unknown,
  ) => {
    console.debug(
      `[Sockets] Sockets-Service: GMCP Incoming: ${module}.${message}`,
    );

    this.gmcpService.handleIncoming(module, message, data);
  };

  private handleGmcpStart = (gmcpSupport: GmcpSupport) => {
    console.info('[Sockets] Sockets-Service: GMCP started', gmcpSupport);

    this.gmcpService.handleGmcpStart(gmcpSupport);
  };

  /**
   * Flushes the input queue by sending all queued messages to the server
   */
  private flushInputQueue = () => {
    if (this.inputQueue.length === 0) {
      return;
    }

    console.log(
      `[Sockets] Sockets-Service: Flushing ${this.inputQueue.length} queued messages`,
    );

    while (this.inputQueue.length > 0) {
      const message = this.inputQueue.shift();
      if (message !== undefined) {
        this.socket.emit('mudInput', message);
      }
    }
  };

  /**
   * Initializes or retrieves the persistent session token from localStorage
   */
  private initializeSessionToken(): string {
    const STORAGE_KEY = 'webmud3-session-token';
    let token = localStorage.getItem(STORAGE_KEY);

    if (!token) {
      // Generate new UUID v4
      token = this.generateUUID();
      this.saveSessionToken(token);
    }

    return token;
  }

  /**
   * Saves the session token to localStorage
   */
  private saveSessionToken(token: string): void {
    try {
      localStorage.setItem('webmud3-session-token', token);
    } catch (error) {
      console.error(
        '[Sockets] Failed to save session token to localStorage:',
        error,
      );
    }
  }

  /**
   * Generates a UUID v4 string
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );
  }
}
