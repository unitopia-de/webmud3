import { TestBed } from '@angular/core/testing';

import { GmcpService } from '../gmcp/gmcp.service';

import { SoundGmcpHandler } from './sound-gmcp-handler';

/**
 * Tests for SoundGmcpHandler.
 *
 * Uses TestBed to properly resolve Angular `inject()` calls.
 * Audio playback is tested via a mock of the global Audio constructor.
 */
describe('SoundGmcpHandler', () => {
  let handler: SoundGmcpHandler;
  let gmcpService: GmcpService;
  let sendSpy: jest.SpyInstance;
  let mockAudioPlay: jest.Mock;
  let mockAudioLoad: jest.Mock;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SoundGmcpHandler, GmcpService],
    });

    handler = TestBed.inject(SoundGmcpHandler);
    gmcpService = TestBed.inject(GmcpService);

    // Spy on sendOutgoing (it won't actually send without a send function)
    sendSpy = jest.spyOn(gmcpService, 'sendOutgoing').mockImplementation();

    // Mock global Audio constructor
    mockAudioPlay = jest.fn().mockResolvedValue(undefined);
    mockAudioLoad = jest.fn();

    (global as any).Audio = jest.fn().mockImplementation(() => ({
      load: mockAudioLoad,
      play: mockAudioPlay,
      src: '',
    }));
  });

  afterEach(() => {
    delete (global as any).Audio;
  });

  describe('moduleName and version', () => {
    it('should have module name "Sound"', () => {
      expect(handler.moduleName).toBe('Sound');
    });

    it('should have version "1"', () => {
      expect(handler.version).toBe('1');
    });
  });

  describe('handleMessage() — Sound.Url', () => {
    it('should store the base URL', () => {
      handler.handleMessage('Url', { url: 'https://mud.example.com/sounds' });

      expect(handler.soundBaseUrl).toBe('https://mud.example.com/sounds');
    });

    it('should handle case-insensitive message name', () => {
      handler.handleMessage('url', { url: 'https://example.com/audio' });

      expect(handler.soundBaseUrl).toBe('https://example.com/audio');
    });
  });

  describe('handleMessage() — Sound.Event', () => {
    beforeEach(() => {
      handler.handleMessage('Url', { url: 'https://mud.example.com/sounds' });
    });

    it('should play audio with the correct URL', () => {
      handler.handleMessage('Event', { file: 'door_open.mp3' });

      expect(global.Audio).toHaveBeenCalledWith(
        'https://mud.example.com/sounds/door_open.mp3',
      );
      expect(mockAudioLoad).toHaveBeenCalled();
      expect(mockAudioPlay).toHaveBeenCalled();
    });

    it('should not play when sound is disabled', () => {
      handler.toggle(); // disable
      expect(handler.isEnabled).toBe(false);

      handler.handleMessage('Event', { file: 'beep.mp3' });

      expect(global.Audio).not.toHaveBeenCalled();
    });

    it('should not play when no base URL is set', () => {
      // Create a fresh handler from TestBed (new instance via override)
      const freshHandler = TestBed.inject(SoundGmcpHandler);
      // Reset its base URL
      freshHandler.dispose();

      freshHandler.handleMessage('Event', { file: 'beep.mp3' });

      expect(global.Audio).not.toHaveBeenCalled();
    });
  });

  describe('toggle()', () => {
    it('should disable sound and send Core.Supports.Remove', () => {
      expect(handler.isEnabled).toBe(true);

      handler.toggle();

      expect(handler.isEnabled).toBe(false);
      expect(sendSpy).toHaveBeenCalledWith(
        'Core',
        'Supports.Remove',
        ['Sound 1'],
      );
    });

    it('should re-enable sound and send Core.Supports.Add', () => {
      handler.toggle(); // disable
      handler.toggle(); // re-enable

      expect(handler.isEnabled).toBe(true);
      expect(sendSpy).toHaveBeenCalledWith(
        'Core',
        'Supports.Add',
        ['Sound 1'],
      );
    });
  });

  describe('getMenuItems()', () => {
    it('should return a single menu item for "Vertonung"', () => {
      const items = handler.getMenuItems();

      expect(items).toHaveLength(1);
      expect(items[0].label).toBe('Vertonung');
      expect(items[0].checked).toBe(true);
    });

    it('should reflect disabled state', () => {
      handler.toggle(); // disable

      const items = handler.getMenuItems();
      expect(items[0].checked).toBe(false);
    });

    it('should have a callable action that toggles', () => {
      const items = handler.getMenuItems();
      items[0].action();

      expect(handler.isEnabled).toBe(false);
    });
  });

  describe('dispose()', () => {
    it('should reset base URL and enabled state', () => {
      handler.handleMessage('Url', { url: 'https://example.com' });
      handler.toggle(); // disable

      handler.dispose();

      expect(handler.soundBaseUrl).toBe('');
      expect(handler.isEnabled).toBe(true);
    });
  });
});
