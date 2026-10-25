import { namespacedKey } from '@webmud3/frontend/shared/utils/storage-namespace';

import { SpeechPacingService } from './speech-pacing.service';

const KEY = namespacedKey('webmud3-ez-speech-pacing');
const RATE_KEY = namespacedKey('webmud3-ez-speech-rate');

describe('SpeechPacingService', () => {
  beforeEach(() => localStorage.clear());

  describe('Schalter', () => {
    it('ist per Default aus', () => {
      expect(new SpeechPacingService().isEnabled()).toBe(false);
    });

    it('liest einen gemerkten Zustand ("1" oder legacy "true")', () => {
      localStorage.setItem(KEY, '1');
      expect(new SpeechPacingService().isEnabled()).toBe(true);

      localStorage.setItem(KEY, 'true');
      expect(new SpeechPacingService().isEnabled()).toBe(true);
    });

    it('fällt bei Müllwerten auf aus zurück', () => {
      localStorage.setItem(KEY, 'vielleicht');
      expect(new SpeechPacingService().isEnabled()).toBe(false);
    });

    it('toggle kippt, persistiert und liefert den neuen Wert', () => {
      const svc = new SpeechPacingService();

      expect(svc.toggle()).toBe(true);
      expect(svc.isEnabled()).toBe(true);
      expect(localStorage.getItem(KEY)).toBe('1');

      expect(svc.toggle()).toBe(false);
      expect(localStorage.getItem(KEY)).toBe('0');
    });

    it('überlebt als frische Instanz', () => {
      new SpeechPacingService().setEnabled(true);
      expect(new SpeechPacingService().isEnabled()).toBe(true);
    });
  });

  describe('Lesetempo', () => {
    it('ist per Default "normal"', () => {
      expect(new SpeechPacingService().rate()).toBe('normal');
    });

    it('liest ein gemerktes Tempo und ignoriert Müll', () => {
      localStorage.setItem(RATE_KEY, 'fast');
      expect(new SpeechPacingService().rate()).toBe('fast');

      localStorage.setItem(RATE_KEY, 'rasend');
      expect(new SpeechPacingService().rate()).toBe('normal');
    });

    it('persistiert eine Änderung', () => {
      const svc = new SpeechPacingService();
      svc.setRate('slow');

      expect(localStorage.getItem(RATE_KEY)).toBe('slow');
      expect(new SpeechPacingService().rate()).toBe('slow');
    });
  });

  describe('estimateMs', () => {
    it('liefert 0 für leeren Text', () => {
      expect(new SpeechPacingService().estimateMs('')).toBe(0);
    });

    it('liefert 0 in Stufe „Ohne Warten"', () => {
      const svc = new SpeechPacingService();
      svc.setRate('off');

      expect(svc.estimateMs('Ein beliebig langer Text. '.repeat(50))).toBe(0);
    });

    it('wächst mit der Textlänge', () => {
      const svc = new SpeechPacingService();
      const kurz = svc.estimateMs('a'.repeat(200));
      const lang = svc.estimateMs('a'.repeat(800));

      expect(lang).toBeGreaterThan(kurz);
    });

    it('greift die Untergrenze bei sehr kurzem Text', () => {
      expect(new SpeechPacingService().estimateMs('Au!')).toBe(400);
    });

    it('greift die Obergrenze bei pathologisch langem Text', () => {
      expect(new SpeechPacingService().estimateMs('a'.repeat(50_000))).toBe(
        30_000,
      );
    });

    it('rechnet Zeilenumbrüche als Satzpausen ein', () => {
      const svc = new SpeechPacingService();
      // Gleiche Zeichenzahl, einmal mit Umbrüchen statt Leerzeichen.
      const flach = svc.estimateMs('wort '.repeat(100));
      const zeilig = svc.estimateMs('wort\n'.repeat(100));

      expect(zeilig).toBeGreaterThan(flach);
    });

    it('schätzt bei höherem Tempo kürzer', () => {
      const svc = new SpeechPacingService();
      const text = 'Ein mittellanger Satz. '.repeat(30);

      svc.setRate('slow');
      const langsam = svc.estimateMs(text);
      svc.setRate('veryFast');
      const schnell = svc.estimateMs(text);

      expect(schnell).toBeLessThan(langsam);
    });
  });

  describe('Sprech-Uhr', () => {
    /** Eingeschalteter Service mit scharfer Uhr (der Normalfall). */
    const scharf = (): SpeechPacingService => {
      const svc = new SpeechPacingService();
      svc.setEnabled(true);
      return svc;
    };

    beforeEach(() => {
      jest.useFakeTimers();
      // Die Uhr basiert auf Date.now() — die moderne Fake-Timer-API mockt das
      // nur mit gesetzter Systemzeit verlässlich.
      jest.setSystemTime(new Date('2026-01-01T12:00:00Z'));
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it('wartet in Stufe „Ohne Warten" nicht', () => {
      const svc = scharf();
      svc.setRate('off');

      // Die Schätzung liefert 0, also wird nichts belegt: nur DOM-Politik.
      svc.reserve(svc.estimateMs('Eine lange Raumbeschreibung. '.repeat(20)));

      expect(svc.remainingMs()).toBe(0);
    });

    it('gibt die Uhr beim Tempowechsel frei', () => {
      const svc = scharf();
      svc.reserve(20_000);
      expect(svc.remainingMs()).toBe(20_000);

      svc.setRate('veryFast');
      expect(svc.remainingMs()).toBe(0);
    });

    it('meldet ohne Reservierung 0', () => {
      expect(new SpeechPacingService().remainingMs()).toBe(0);
    });

    it('zählt eine Reservierung herunter', () => {
      const svc = scharf();

      svc.reserve(1000);
      expect(svc.remainingMs()).toBe(1000);

      jest.advanceTimersByTime(400);
      expect(svc.remainingMs()).toBe(600);
    });

    it('wird nie negativ', () => {
      const svc = scharf();
      svc.reserve(1000);

      jest.advanceTimersByTime(5000);
      expect(svc.remainingMs()).toBe(0);
    });

    it('verkürzt eine längere laufende Reservierung nicht', () => {
      const svc = scharf();

      svc.reserve(5000);
      svc.reserve(500);

      expect(svc.remainingMs()).toBe(5000);
    });

    it('reserviert nichts, solange das Feature aus ist', () => {
      const svc = new SpeechPacingService();
      svc.reserve(5000);

      expect(svc.remainingMs()).toBe(0);
    });

    it('reset gibt die Uhr sofort frei', () => {
      const svc = scharf();
      svc.reserve(5000);

      svc.reset();
      expect(svc.remainingMs()).toBe(0);
    });

    it('Abschalten löscht eine laufende Reservierung', () => {
      const svc = scharf();
      svc.reserve(5000);

      svc.setEnabled(false);
      expect(svc.remainingMs()).toBe(0);
    });
  });
});
