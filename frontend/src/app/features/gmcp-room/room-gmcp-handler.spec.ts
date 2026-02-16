import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';

import { RoomGmcpHandler, RoomInfo } from './room-gmcp-handler';

describe('RoomGmcpHandler', () => {
  let handler: RoomGmcpHandler;
  let titleService: Title;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [RoomGmcpHandler, Title],
    });

    handler = TestBed.inject(RoomGmcpHandler);
    titleService = TestBed.inject(Title);
  });

  it('should have correct module metadata', () => {
    expect(handler.moduleName).toBe('Room');
    expect(handler.version).toBe('1');
  });

  describe('Room.Info', () => {
    it('should store room info', () => {
      handler.handleMessage('Info', {
        name: 'Marktplatz',
        domain: 'stadt',
        exits: ['norden', 'sueden', 'osten'],
      });

      const info = handler.roomInfo$.value;

      expect(info).not.toBeNull();
      expect(info!.name).toBe('Marktplatz');
      expect(info!.domain).toBe('stadt');
      expect(info!.exits).toEqual(['norden', 'sueden', 'osten']);
    });

    it('should update browser title', () => {
      const spy = jest.spyOn(titleService, 'setTitle');

      handler.handleMessage('Info', { name: 'Marktplatz' });

      expect(spy).toHaveBeenCalledWith('Marktplatz - WebMud3');
    });

    it('should emit on roomInfo$ observable', () => {
      const emissions: (RoomInfo | null)[] = [];
      handler.roomInfo$.subscribe(r => emissions.push(r));

      handler.handleMessage('Info', { name: 'Taverne' });

      expect(emissions).toHaveLength(2); // null + Taverne
      expect(emissions[1]!.name).toBe('Taverne');
    });
  });

  describe('dispose', () => {
    it('should reset room info and title', () => {
      const spy = jest.spyOn(titleService, 'setTitle');

      handler.handleMessage('Info', { name: 'Test' });
      handler.dispose();

      expect(handler.roomInfo$.value).toBeNull();
      expect(spy).toHaveBeenCalledWith('WebMud3');
    });
  });
});
