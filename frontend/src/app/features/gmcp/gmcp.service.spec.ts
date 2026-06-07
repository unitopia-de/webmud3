import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';

import { SocketsService } from '../sockets/sockets.service';
import { GmcpService, GmcpMessage } from './gmcp.service';
import type { GmcpModule, GmcpModuleSupport } from './gmcp-module';

function fakeModule(
  supports: GmcpModuleSupport[],
  handleMessage = jest.fn(),
): GmcpModule & { handleMessage: jest.Mock; onActivate: jest.Mock; onDeactivate: jest.Mock } {
  return {
    supports,
    handleMessage,
    onActivate: jest.fn(),
    onDeactivate: jest.fn(),
  } as unknown as GmcpModule & {
    handleMessage: jest.Mock;
    onActivate: jest.Mock;
    onDeactivate: jest.Mock;
  };
}

describe('GmcpService', () => {
  let onGmcpActive: Subject<boolean>;
  let onGmcpIncoming: Subject<{
    packageName: string;
    messageName: string;
    data: unknown;
  }>;
  let sendGmcp: jest.Mock;
  let svc: GmcpService;

  beforeEach(() => {
    onGmcpActive = new Subject();
    onGmcpIncoming = new Subject();
    sendGmcp = jest.fn();
    const sockets = { onGmcpActive, onGmcpIncoming, sendGmcp };
    TestBed.configureTestingModule({
      providers: [
        { provide: SocketsService, useValue: sockets as unknown as SocketsService },
      ],
    });
    svc = TestBed.inject(GmcpService);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('starts inactive', () => {
    const seen: boolean[] = [];
    svc.active$.subscribe((v) => seen.push(v));
    expect(seen).toEqual([false]);
  });

  it('sends Core.Hello on activation', () => {
    onGmcpActive.next(true);
    expect(sendGmcp).toHaveBeenCalledWith(
      'Core.Hello',
      expect.objectContaining({ client: 'WebMud3' }),
    );
  });

  it('on activation sends Core.Supports.Set for registered modules', () => {
    svc.registerModule(fakeModule([{ name: 'Char', version: 1 } as GmcpModuleSupport]));
    onGmcpActive.next(true);
    expect(sendGmcp).toHaveBeenCalledWith('Core.Supports.Set', ['Char 1']);
  });

  it('registering while already active sends an incremental support set + onActivate', () => {
    onGmcpActive.next(true);
    sendGmcp.mockClear();
    const mod = fakeModule([{ name: 'Room', version: 1 } as GmcpModuleSupport]);
    svc.registerModule(mod);
    expect(sendGmcp).toHaveBeenCalledWith('Core.Supports.Set', ['Room 1']);
    expect(mod.onActivate).toHaveBeenCalled();
  });

  it('routes an incoming message to the registered handler and the global stream', () => {
    const handler = jest.fn();
    svc.registerModule(fakeModule([{ name: 'Char', version: 1 } as GmcpModuleSupport], handler));

    const seen: GmcpMessage[] = [];
    svc.messages$.subscribe((m) => seen.push(m));

    onGmcpIncoming.next({ packageName: 'Char', messageName: 'Name', data: { name: 'Boronx' } });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      packageName: 'Char',
      messageName: 'Name',
      fullMessage: 'Char.Name',
      data: { name: 'Boronx' },
    });
  });

  it('onMessage filters by the full module string', () => {
    const seen: GmcpMessage[] = [];
    svc.onMessage('Char.Name').subscribe((m) => seen.push(m));
    onGmcpIncoming.next({ packageName: 'Char', messageName: 'Vitals', data: {} });
    onGmcpIncoming.next({ packageName: 'Char', messageName: 'Name', data: {} });
    expect(seen).toHaveLength(1);
    expect(seen[0].messageName).toBe('Name');
  });

  it('onPackage filters by package', () => {
    const seen: GmcpMessage[] = [];
    svc.onPackage('Char').subscribe((m) => seen.push(m));
    onGmcpIncoming.next({ packageName: 'Char', messageName: 'Name', data: {} });
    onGmcpIncoming.next({ packageName: 'Room', messageName: 'Info', data: {} });
    expect(seen).toHaveLength(1);
    expect(seen[0].packageName).toBe('Char');
  });

  it('send delegates only when active', () => {
    svc.send('Char.Login', { name: 'x' });
    expect(sendGmcp).not.toHaveBeenCalled(); // inactive → warn + drop

    onGmcpActive.next(true);
    sendGmcp.mockClear();
    svc.send('Char.Login', { name: 'x' });
    expect(sendGmcp).toHaveBeenCalledWith('Char.Login', { name: 'x' });
  });

  it('unregister sends Core.Supports.Remove when active', () => {
    const mod = fakeModule([{ name: 'Room', version: 2 } as GmcpModuleSupport]);
    svc.registerModule(mod);
    onGmcpActive.next(true);
    sendGmcp.mockClear();

    svc.unregisterModule(mod);
    expect(mod.onDeactivate).toHaveBeenCalled();
    expect(sendGmcp).toHaveBeenCalledWith('Core.Supports.Remove', ['Room 2']);
  });

  it('notifies modules on deactivation', () => {
    const mod = fakeModule([{ name: 'Char', version: 1 } as GmcpModuleSupport]);
    svc.registerModule(mod);
    onGmcpActive.next(true);
    onGmcpActive.next(false);
    expect(mod.onDeactivate).toHaveBeenCalled();
  });
});
