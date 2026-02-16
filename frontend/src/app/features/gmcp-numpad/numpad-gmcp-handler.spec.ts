import { TestBed } from '@angular/core/testing';

import { NumpadGmcpHandler } from './numpad-gmcp-handler';
import { GmcpService } from '../gmcp/gmcp.service';
import { WindowService } from '../windows/window.service';
import { KeypadData } from './keypad-data';

describe('NumpadGmcpHandler', () => {
  let handler: NumpadGmcpHandler;
  let gmcpService: GmcpService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [NumpadGmcpHandler, GmcpService, WindowService],
    });

    handler = TestBed.inject(NumpadGmcpHandler);
    gmcpService = TestBed.inject(GmcpService);
  });

  it('should have correct module metadata', () => {
    expect(handler.moduleName).toBe('Numpad');
    expect(handler.version).toBe('1');
  });

  describe('Numpad.SendLevel', () => {
    it('should store key mappings from SendLevel', () => {
      handler.handleMessage('SendLevel', {
        prefix: '',
        keys: {
          Numpad7: 'nordwesten',
          Numpad8: 'norden',
          Numpad9: 'nordosten',
        },
      });

      expect(handler.hasData).toBe(true);
      expect(handler.lookupCommand('|Numpad7')).toBe('nordwesten');
      expect(handler.lookupCommand('|Numpad8')).toBe('norden');
      expect(handler.lookupCommand('|Numpad9')).toBe('nordosten');
    });

    it('should support modifier levels', () => {
      handler.handleMessage('SendLevel', {
        prefix: 'shift',
        keys: { Numpad7: 'schleiche nordwesten' },
      });

      expect(handler.lookupCommand('shift|Numpad7')).toBe('schleiche nordwesten');
      expect(handler.lookupCommand('|Numpad7')).toBe('');
    });

    it('should emit on keypadData$', () => {
      const emissions: KeypadData[] = [];
      handler.keypadData$.subscribe(d => emissions.push(d));

      handler.handleMessage('SendLevel', {
        prefix: '',
        keys: { Numpad5: 'schaue' },
      });

      // Initial + after SendLevel
      expect(emissions.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('sendUpdate', () => {
    it('should send GMCP Numpad.Update', () => {
      const spy = jest.spyOn(gmcpService, 'sendOutgoing').mockImplementation(() => {});

      handler.sendUpdate('', 'Numpad7', 'nordwesten');

      expect(spy).toHaveBeenCalledWith('Numpad', 'Update', {
        prefix: '',
        key: 'Numpad7',
        value: 'nordwesten',
      });
    });
  });

  describe('requestAll', () => {
    it('should send GMCP Numpad.GetAll', () => {
      const spy = jest.spyOn(gmcpService, 'sendOutgoing').mockImplementation(() => {});

      handler.requestAll();

      expect(spy).toHaveBeenCalledWith('Numpad', 'GetAll', {});
    });
  });

  describe('dispose', () => {
    it('should reset keypad data', () => {
      handler.handleMessage('SendLevel', {
        prefix: '',
        keys: { Numpad5: 'schaue' },
      });

      expect(handler.hasData).toBe(true);

      handler.dispose();

      expect(handler.hasData).toBe(false);
    });
  });
});
