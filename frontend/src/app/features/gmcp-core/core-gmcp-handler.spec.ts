import { TestBed } from '@angular/core/testing';

import { CoreGmcpHandler } from './core-gmcp-handler';
import { GmcpService } from '../gmcp/gmcp.service';
import { WindowService } from '../windows/window.service';

describe('CoreGmcpHandler', () => {
  let handler: CoreGmcpHandler;
  let gmcpService: GmcpService;
  let windowService: WindowService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CoreGmcpHandler, GmcpService, WindowService],
    });

    handler = TestBed.inject(CoreGmcpHandler);
    gmcpService = TestBed.inject(GmcpService);
    windowService = TestBed.inject(WindowService);
  });

  it('should have correct module metadata', () => {
    expect(handler.moduleName).toBe('Core');
    expect(handler.version).toBe('1');
  });

  describe('Core.Ping', () => {
    it('should toggle pingToggle$ on Ping message', () => {
      // Mock the sendOutgoing to avoid "not active" warning
      jest.spyOn(gmcpService, 'sendOutgoing').mockImplementation(() => {});

      expect(handler.pingToggle$.value).toBe(false);

      handler.handleMessage('Ping', {});
      expect(handler.pingToggle$.value).toBe(true);

      handler.handleMessage('Ping', {});
      expect(handler.pingToggle$.value).toBe(false);
    });

    it('should send pong back on Ping message', () => {
      const sendSpy = jest.spyOn(gmcpService, 'sendOutgoing').mockImplementation(() => {});

      handler.handleMessage('Ping', {});

      expect(sendSpy).toHaveBeenCalledWith('Core', 'Ping', {});
    });

    it('should calculate latency when ping was initiated by client', () => {
      jest.spyOn(gmcpService, 'sendOutgoing').mockImplementation(() => {});

      // Simulate sending a ping
      const now = Date.now();
      jest.spyOn(Date, 'now')
        .mockReturnValueOnce(now) // sendPing timestamp
        .mockReturnValueOnce(now + 42); // handlePing timestamp

      handler.sendPing();
      handler.handleMessage('Ping', {});

      expect(handler.latency$.value).toBe(42);
    });

    it('should not calculate latency for unsolicited pings', () => {
      jest.spyOn(gmcpService, 'sendOutgoing').mockImplementation(() => {});

      handler.handleMessage('Ping', {});

      expect(handler.latency$.value).toBeNull();
    });
  });

  describe('Core.Goodbye', () => {
    it('should close all windows on Goodbye', () => {
      const closeAllSpy = jest.spyOn(windowService, 'closeAll');
      const resetSpy = jest.spyOn(gmcpService, 'reset');

      handler.handleMessage('Goodbye', 'See you later!');

      expect(closeAllSpy).toHaveBeenCalled();
      expect(resetSpy).toHaveBeenCalled();
    });

    it('should handle Goodbye with object payload', () => {
      const closeAllSpy = jest.spyOn(windowService, 'closeAll');
      const resetSpy = jest.spyOn(gmcpService, 'reset');

      handler.handleMessage('Goodbye', { message: 'Auf Wiedersehen!' });

      expect(closeAllSpy).toHaveBeenCalled();
      expect(resetSpy).toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should reset state on dispose', () => {
      jest.spyOn(gmcpService, 'sendOutgoing').mockImplementation(() => {});

      // Set some state first
      handler.handleMessage('Ping', {});
      expect(handler.pingToggle$.value).toBe(true);

      handler.dispose();

      expect(handler.pingToggle$.value).toBe(false);
      expect(handler.latency$.value).toBeNull();
    });
  });
});
