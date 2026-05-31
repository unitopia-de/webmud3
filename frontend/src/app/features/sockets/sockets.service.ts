import { EventEmitter, inject, Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Manager, Socket } from 'socket.io-client';

import { ServerConfigService } from '../../features/serverconfig/server-config.service';
import { SecureString } from '@webmud3/frontend/shared/types/secure-string';
import { isSecureString } from '@webmud3/frontend/shared/utils/is-secure-string';
import { namespacedStorage } from '@webmud3/frontend/shared/utils/storage-namespace';
import { OutputHistoryService } from '@webmud3/frontend/shared/services/output-history.service';

import type {
  ClientToServerEvents,
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
  private readonly manager: Manager;
  private readonly socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  private readonly connectedToServer = new BehaviorSubject<boolean>(false);
  private readonly connectedToMud = new BehaviorSubject<boolean>(false);
  private readonly inputQueue: string[] = [];
  private isReconnecting = false;
  private sessionToken: string;
  // Forces a fresh session token after reconnect failed to avoid reusing a dead backend session.
  private forceNewSession = false;
  // The first serverHello received after page load. Subsequent serverHello
  // events with a different id mean the backend was restarted; we then
  // reload the page to pick up any new code and drop stale state.
  //
  // Persisted to localStorage so the comparison survives a page refresh —
  // otherwise the first serverHello after a refresh always passes through
  // unchecked and the old (now-stale) history stays on screen even though
  // the backend changed identity in the meantime.
  private knownServerId: string | undefined;

  public onMudConnect = new EventEmitter<boolean>(); // Emits isNewConnection
  public onMudDisconnect = new EventEmitter();
  public onMudOutput = new EventEmitter<MudOutputEventArgs>();
  public onSetEchoMode = new EventEmitter<boolean>();
  public onSetLinemode = new EventEmitter<LinemodeState>();
  public onGmcpActive = new EventEmitter<boolean>();
  public onGmcpIncoming = new EventEmitter<{
    packageName: string;
    messageName: string;
    data: unknown;
  }>();

  public readonly connectedToServer$ = this.connectedToServer.asObservable();
  public readonly connectedToMud$ = this.connectedToMud.asObservable();

  /**
   * Synchronous snapshot of the current MUD-connection state.
   * Needed by callers that have to decide at mount-time whether to
   * initiate a new telnet session — subscribing for one tick would
   * introduce a race window during which a duplicate connect could fire.
   */
  public get isConnectedToMud(): boolean {
    return this.connectedToMud.value;
  }

  public constructor(serverConfigService: ServerConfigService) {
    const socketUrl = serverConfigService.getBackendUrl();
    const socketNamespace = serverConfigService.getSocketNamespace();

    // Initialize or retrieve persistent session token
    this.sessionToken = this.initializeSessionToken();
    // Restore the last-seen backend id so handleServerHello can detect
    // a backend restart that happened across a page refresh.
    this.knownServerId =
      namespacedStorage.get('webmud3-known-server-id') ?? undefined;

    console.log('[Sockets] Socket Service init socket', {
      socketUrl,
      socketNamespace,
      sessionToken: this.sessionToken,
    });

    this.manager = new Manager(socketUrl, {
      path: socketNamespace,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity,
      reconnection: true,
      // Shorter first retry (default is 1000ms) so a reconnect after a tab
      // resume / brief network blip feels near-instant in PWA mode.
      reconnectionDelay: 500,
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.socket as unknown as any).on(
      'mudGmcpActive',
      (active: boolean) => {
        this.handleGmcpActive(active);
      },
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.socket as unknown as any).on('serverShutdown', () => {
      this.handleServerShutdown();
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.socket as unknown as any).on('serverHello', (serverId: string) => {
      this.handleServerHello(serverId);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.socket as unknown as any).on(
      'mudGmcpIncoming',
      (packageName: string, messageName: string, data: unknown) => {
        this.handleGmcpIncoming(packageName, messageName, data);
      },
    );
  }

  public connectToMud(initialViewPort: {
    columns: number;
    rows: number;
  }): void {
    if (this.forceNewSession) {
      this.resetSessionToken();
      this.forceNewSession = false;
    }

    console.log(
      `[Sockets] Sockets-Service: 'connectToMud' with sessionToken: ${this.sessionToken}`,
    );
    this.socket.emit('mudConnect', initialViewPort, this.sessionToken);
  }

  public disconnectFromMud() {
    console.log(`[Sockets] Sockets-Service: 'disconnect'`);
    this.socket.emit('mudDisconnect');
  }

  /**
   * Forces an immediate reconnect attempt when the socket is down, instead of
   * waiting for socket.io's backoff timer. Used after the tab/PWA becomes
   * visible again or the network comes back (iOS freezes background JS, so the
   * auto-reconnect loop may be stalled). No-op when already connected. The MUD
   * session itself resumes via the sessionToken auth on the new handshake.
   */
  public ensureConnected(): void {
    if (this.socket && !this.socket.connected) {
      console.info(
        '[Sockets] Sockets-Service: ensureConnected → socket down, forcing reconnect',
      );
      this.socket.connect();
    }
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

  public sendGmcp(module: string, data: unknown): void {
    console.log(`[Sockets] Sockets-Service: 'sendGmcp'`, { module, data });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.socket as unknown as any).emit('mudGmcpOutgoing', module, data);
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
    this.forceNewSession = true;

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

  private handleServerShutdown = () => {
    console.warn(
      '[Sockets] Sockets-Service: Server announced shutdown. Waiting for new backend to come up.',
    );

    // We deliberately keep the auto-reconnect loop running. When the backend
    // is back, the next connect will produce a new serverHello with a
    // different serverId, which triggers the page reload in handleServerHello.
  };

  private handleServerHello = (serverId: string) => {
    if (this.knownServerId === undefined) {
      // First serverHello ever (or right after a clean reload). Persist
      // the id so a future refresh can detect a backend change.
      this.knownServerId = serverId;
      this.saveKnownServerId(serverId);
      console.info(
        `[Sockets] Sockets-Service: Server hello, serverId=${serverId}`,
      );
      return;
    }

    if (serverId === this.knownServerId) {
      // Reconnect to the same backend instance — nothing to do.
      return;
    }

    console.warn(
      `[Sockets] Sockets-Service: Backend change detected (old=${this.knownServerId}, new=${serverId}). Clearing local state and reloading.`,
    );

    // The previous session-token and output-history belong to a backend
    // that no longer exists. Clear both so the freshly loaded page starts
    // clean and can establish a new session against the new backend.
    // We also overwrite the stored server-id with the new one — otherwise
    // the reloaded page would see (stored=old, incoming=new) again and
    // loop reloading forever.
    this.outputHistoryService.clearAll();
    this.saveKnownServerId(serverId);

    try {
      namespacedStorage.remove('webmud3-session-token');
    } catch (error) {
      console.error(
        '[Sockets] Failed to clear session token from localStorage:',
        error,
      );
    }

    // Backend changed → almost always a redeploy, i.e. new frontend code
    // too. Do the closest thing to a cold refresh that JS allows before
    // reloading (see coldReload).
    void this.coldReload();
  };

  /**
   * Approximates a "cold" / hard refresh (Ctrl+Shift+R) before reloading.
   *
   * A literal cache-bypassing reload is NOT scriptable — browsers don't
   * expose it (`location.reload(true)` is deprecated and ignored). The
   * effective equivalent is to purge everything that could hand back a
   * stale app shell, then reload normally:
   *   - Cache Storage (the CacheStorage API) — emptied.
   *   - Registered service workers — unregistered.
   *
   * index.html is already served `no-store` and the JS/CSS bundles are
   * content-hashed, so a plain reload usually suffices. This extra purge
   * hardens against iOS Safari clinging to an old bundle after a redeploy
   * and against a future PWA service worker (see PWA_TODO.md) serving a
   * cached shell. Every step is best-effort and never blocks the reload.
   */
  private async coldReload(): Promise<void> {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.allSettled(keys.map((key) => caches.delete(key)));
      }
    } catch (error) {
      console.error('[Sockets] coldReload: clearing CacheStorage failed', error);
    }

    try {
      if ('serviceWorker' in navigator) {
        const registrations =
          await navigator.serviceWorker.getRegistrations();
        await Promise.allSettled(registrations.map((reg) => reg.unregister()));
      }
    } catch (error) {
      console.error('[Sockets] coldReload: unregistering SW failed', error);
    }

    window.location.reload();
  }

  private saveKnownServerId(serverId: string): void {
    try {
      namespacedStorage.set('webmud3-known-server-id', serverId);
    } catch (error) {
      console.error(
        '[Sockets] Failed to persist known server id to localStorage:',
        error,
      );
    }
  }

  private handleGmcpActive = (active: boolean) => {
    console.info('[Sockets] Sockets-Service: GMCP active:', active);

    this.onGmcpActive.emit(active);
  };

  private handleGmcpIncoming = (
    packageName: string,
    messageName: string,
    data: unknown,
  ) => {
    console.debug('[Sockets] Sockets-Service: GMCP incoming:', {
      packageName,
      messageName,
      data,
    });

    this.onGmcpIncoming.emit({ packageName, messageName, data });
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
    let token = namespacedStorage.get('webmud3-session-token');

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
      namespacedStorage.set('webmud3-session-token', token);
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

  /**
   * Resets the session token to force a clean backend session on next connect.
   * This is used after a reconnect failure to avoid reusing a potentially dead backend session.
   */
  private resetSessionToken(): void {
    const newToken = this.generateUUID();
    this.sessionToken = newToken;
    this.saveSessionToken(newToken);
    this.socket.auth = { sessionToken: newToken };
  }
}
