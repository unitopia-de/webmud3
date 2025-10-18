import { EventEmitter, Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Manager, Socket } from 'socket.io-client';

import { ServerConfigService } from '../../features/serverconfig/server-config.service';
import { ClientToServerEvents } from './types/client-to-server-events';
import { ServerToClientEvents } from './types/server-to-client-events';
import { LinemodeState } from './types/linemode-state';
import { isSecureString, SecureString } from '@mudlet3/frontend/shared';

type MudOutputEventArgs = {
  data: string;
};

@Injectable({
  providedIn: 'root',
})
export class SocketsService {
  private readonly manager: Manager;
  private readonly socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  private readonly connectedToServer = new BehaviorSubject<boolean>(false);
  private readonly connectedToMud = new BehaviorSubject<boolean>(false);

  public onMudConnect = new EventEmitter();
  public onMudDisconnect = new EventEmitter();
  public onMudOutput = new EventEmitter<MudOutputEventArgs>();
  public onSetEchoMode = new EventEmitter<boolean>();
  public onSetLinemode = new EventEmitter<LinemodeState>();

  public readonly connectedToServer$ = this.connectedToServer.asObservable();
  public readonly connectedToMud$ = this.connectedToMud.asObservable();

  public constructor(serverConfigService: ServerConfigService) {
    const socketUrl = serverConfigService.getBackendUrl();
    const socketNamespace = serverConfigService.getSocketNamespace();

    console.log('[Sockets] Socket Service init socket', {
      socketUrl,
      socketNamespace,
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

    this.socket = this.manager.socket('/');

    this.socket.on('connect', () => {
      this.handleConnect();
    });

    this.socket.on('disconnect', (reason: string) => {
      this.handleDisconnect(reason);
    });

    this.socket.on('mudConnected', () => {
      this.handleMudConnect();
    });

    this.socket.on('mudDisconnected', () => {
      this.handleMudDisconnect();
    });

    this.socket.on('mudOutput', (output: string) => {
      this.handleMudOutput(output);
    });

    this.socket.on('setEchoMode', (showEchos: boolean) => {
      this.handleSetEchoMode(showEchos);
    });

    this.socket.on('setLinemode', (state: LinemodeState) => {
      this.handleSetLinemode(state);
    });

    this.socket.on('requestTimingMark', (callback: () => void) => {
      this.handleTimingMark(callback);
    });
  }

  public connectToMud(initialViewPort: {
    columns: number;
    rows: number;
  }): void {
    console.log(`[Sockets] Sockets-Service: 'connectToMud'`);
    this.socket.emit('mudConnect', initialViewPort);
  }

  public disconnectFromMud() {
    console.log(`[Sockets] Sockets-Service: 'disconnect'`);
    this.socket.emit('mudDisconnect');
  }

  public sendMessage(message: string | SecureString) {
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

  public sendGmcp(/*id: string, mod: string, msg: string, data: any*/): boolean {
    console.log(`[Sockets] Sockets-Service: 'sendGmcp'`);
    throw new Error('Method not implemented.');
  }

  private handleMudConnect = () => {
    this.connectedToMud.next(true);

    this.onMudConnect.emit();
  };

  private handleMudDisconnect = () => {
    console.log(`[Sockets] Sockets-Service: received 'mudDisconnected'`);

    this.connectedToMud.next(false);

    this.onMudDisconnect.emit();
  };

  private handleMudOutput = (output: string) => {
    this.onMudOutput.emit({
      data: output,
    });
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
  };

  private handleReconnectAttempt = (attempt: number) => {
    console.info('[Sockets] Sockets-Service: Reconnect Attempt:', attempt);
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
}
