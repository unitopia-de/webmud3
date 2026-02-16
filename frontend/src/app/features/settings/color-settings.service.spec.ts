import { TestBed } from '@angular/core/testing';

import { ColorSettingsService } from './color-settings.service';

describe('ColorSettingsService', () => {
  let service: ColorSettingsService;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [ColorSettingsService],
    });

    service = TestBed.inject(ColorSettingsService);
  });

  it('should start with default settings', () => {
    expect(service.current.invertColors).toBe(false);
    expect(service.current.blackOnWhite).toBe(false);
    expect(service.current.disableColors).toBe(false);
    expect(service.current.localEchoColor).toBe('#a6e3a1');
  });

  describe('save', () => {
    it('should update current settings', () => {
      service.save({ ...service.current, invertColors: true });

      expect(service.current.invertColors).toBe(true);
    });

    it('should persist to localStorage', () => {
      service.save({ ...service.current, blackOnWhite: true });

      const stored = JSON.parse(localStorage.getItem('webmud3-color-settings')!);

      expect(stored.blackOnWhite).toBe(true);
    });

    it('should emit on settings$ observable', () => {
      const emissions: boolean[] = [];
      const sub = service.settings$.subscribe(s => emissions.push(s.invertColors));

      service.save({ ...service.current, invertColors: true });

      expect(emissions).toContain(true);

      sub.unsubscribe();
    });
  });

  describe('update', () => {
    it('should update a single property', () => {
      service.update({ disableColors: true });

      expect(service.current.disableColors).toBe(true);
      expect(service.current.invertColors).toBe(false);
    });
  });

  describe('reset', () => {
    it('should restore default settings', () => {
      service.save({
        invertColors: true,
        blackOnWhite: true,
        disableColors: true,
        localEchoColor: '#ff0000',
      });

      service.reset();

      expect(service.current.invertColors).toBe(false);
      expect(service.current.blackOnWhite).toBe(false);
      expect(service.current.disableColors).toBe(false);
      expect(service.current.localEchoColor).toBe('#a6e3a1');
    });
  });

  describe('getXtermTheme', () => {
    it('should return a valid theme with default settings', () => {
      const theme = service.getXtermTheme();

      expect(theme.background).toBe('#1e1e2e');
      expect(theme.foreground).toBe('#cdd6f4');
      expect(theme.cursor).toBeDefined();
    });

    it('should apply monochrome mode', () => {
      service.update({ disableColors: true });

      const theme = service.getXtermTheme();

      // All ANSI colors should be either foreground or background
      expect(theme.red).toBe(theme.foreground);
      expect(theme.green).toBe(theme.foreground);
      expect(theme.blue).toBe(theme.foreground);
    });

    it('should apply inversion', () => {
      const defaultTheme = service.getXtermTheme();
      service.update({ invertColors: true });
      const invertedTheme = service.getXtermTheme();

      expect(invertedTheme.background).not.toBe(defaultTheme.background);
      expect(invertedTheme.foreground).not.toBe(defaultTheme.foreground);
    });

    it('should apply black-on-white mode', () => {
      service.update({ blackOnWhite: true });

      const theme = service.getXtermTheme();

      expect(theme.background).toBe('#eff1f5');
      expect(theme.foreground).toBe('#4c4f69');
    });
  });
});
