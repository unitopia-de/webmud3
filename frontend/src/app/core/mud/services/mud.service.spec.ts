import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';

import { GmcpService } from '@webmud3/frontend/features/gmcp/gmcp.service';
import { MudSignalService } from '@webmud3/frontend/features/gmcp/signals/mud-signal.service';
import { SocketsService } from '@webmud3/frontend/features/sockets/sockets.service';
import { MudService } from './mud.service';

describe('MudService', () => {
  let connected: boolean;
  let connectToMud: jest.Mock;
  let updateViewportSize: jest.Mock;
  let sendMessage: jest.Mock;
  let sendGmcp: jest.Mock;
  let svc: MudService;

  beforeEach(() => {
    connected = false;
    connectToMud = jest.fn();
    updateViewportSize = jest.fn();
    sendMessage = jest.fn();
    sendGmcp = jest.fn();

    const sockets = {
      connectedToMud$: new Subject(),
      get isConnectedToMud() {
        return connected;
      },
      onSetEchoMode: new Subject(),
      onSetLinemode: new Subject(),
      onMudOutput: new Subject(),
      onMudConnect: new Subject(),
      connectToMud,
      disconnectFromMud: jest.fn(),
      updateViewportSize,
      ensureConnected: jest.fn(),
      sendMessage,
      sendGmcp,
    };
    const gmcp = {
      active$: new Subject(),
      messages$: new Subject(),
      send: jest.fn(),
      onMessage: jest.fn(),
      onPackage: jest.fn(),
    };
    const signalService = { signals$: new Subject(), on: jest.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: SocketsService, useValue: sockets as unknown as SocketsService },
        { provide: GmcpService, useValue: gmcp as unknown as GmcpService },
        {
          provide: MudSignalService,
          useValue: signalService as unknown as MudSignalService,
        },
      ],
    });
    svc = TestBed.inject(MudService);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('connect() opens a fresh telnet session when not connected', () => {
    svc.connect({ columns: 100, rows: 40 });
    expect(connectToMud).toHaveBeenCalledWith({ columns: 100, rows: 40 });
    expect(updateViewportSize).not.toHaveBeenCalled();
  });

  it('connect() is idempotent — only updates the viewport when already connected', () => {
    connected = true;
    svc.connect({ columns: 120, rows: 50 });
    expect(connectToMud).not.toHaveBeenCalled();
    expect(updateViewportSize).toHaveBeenCalledWith(120, 50);
  });

  it('reconnect() reuses the last viewport passed to connect()', () => {
    svc.connect({ columns: 90, rows: 30 });
    connectToMud.mockClear();
    svc.reconnect();
    expect(connectToMud).toHaveBeenCalledWith({ columns: 90, rows: 30 });
  });

  it('updateViewportSize() caches the size for a later reconnect', () => {
    svc.updateViewportSize(70, 20);
    expect(updateViewportSize).toHaveBeenCalledWith(70, 20);
    svc.reconnect();
    expect(connectToMud).toHaveBeenCalledWith({ columns: 70, rows: 20 });
  });

  it('isConnected reflects the socket state', () => {
    expect(svc.isConnected).toBe(false);
    connected = true;
    expect(svc.isConnected).toBe(true);
  });

  it('sendMessage delegates to the socket', () => {
    svc.sendMessage('nord');
    expect(sendMessage).toHaveBeenCalledWith('nord');
  });

  it('sendGmcp delegates to the gmcp service', () => {
    svc.sendGmcp('Core.Hello', { client: 'x' });
    expect(TestBed.inject(GmcpService).send).toHaveBeenCalledWith('Core.Hello', {
      client: 'x',
    });
  });
});
