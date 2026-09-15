import { Injectable, signal } from '@angular/core';

import { namespacedStorage } from '@webmud3/frontend/shared/utils/storage-namespace';

const STORAGE_SUFFIX = 'webmud3-ez-speech-pacing';
const RATE_STORAGE_SUFFIX = 'webmud3-ez-speech-rate';

/**
 * Wählbares Lesetempo in Wörtern pro Minute — plus die Sonderstufe `'off'`.
 *
 * Das Tempo des Screenreaders ist aus der Seite heraus nicht auslesbar, und
 * blinde Power-User fahren oft 300–450 WPM. Wird zu langsam geschätzt, wartet
 * der Client hörbar zu lange; wird zu schnell geschätzt, kehren die
 * Unterbrechungen zurück. Deshalb entscheidet der Nutzer.
 *
 * `'off'` schaltet das Warten ganz ab: Dann wirkt „Ausreden lassen" nur noch
 * über die DOM-Politik (kein Ersetzen, kein Trimmen, Mindest-Bündelung) — also
 * genau die Eingriffe, die deterministisch sind und keine Schätzung brauchen.
 * Das ist der ehrliche KONTROLL-Modus: Bleibt das Abschneiden auch damit weg,
 * lag es nie am Timing, und die Schätzerei kann entfallen.
 */
export type SpeechRate = 'off' | 'slow' | 'normal' | 'fast' | 'veryFast';

/** Wörter pro Minute je Stufe; `0` = nicht warten. */
export const SPEECH_RATE_WPM: Record<SpeechRate, number> = {
  off: 0,
  slow: 150,
  normal: 200,
  fast: 300,
  veryFast: 450,
};

const VALID_RATES: readonly SpeechRate[] = [
  'off',
  'slow',
  'normal',
  'fast',
  'veryFast',
];
const DEFAULT_RATE: SpeechRate = 'normal';

/**
 * Mittlere deutsche Wortlänge inklusive Trennzeichen. Die Schätzung rechnet
 * bewusst ZEICHEN-, nicht wortbasiert: deutsche Komposita
 * („Zwergenschmiedehammer") und Zahlenkolonnen lassen eine Wortzählung die
 * Dauer massiv unterschätzen.
 */
const CHARS_PER_WORD = 6.5;

/**
 * Sockel zwischen DOM-Mutation und tatsächlichem Sprechbeginn. Ohne ihn
 * startet die Uhr zu früh und der nächste Eintrag drängelt sich vor.
 */
const BASE_LATENCY_MS = 250;

/** Satzpause, die Screenreader am Zeilenende einlegen. */
const LINE_BREAK_PAUSE_MS = 120;

/**
 * Untergrenze je Eintrag. Verhindert, dass ein Einzelwort („Autsch!") zu einem
 * 80-ms-Slot wird und der Rückstau doch wieder zu Unterbrechungen führt.
 */
const MIN_SLOT_MS = 400;

/**
 * Obergrenze je Eintrag. Eine ausgewachsene Raumbeschreibung (~600 Zeichen)
 * braucht bei 200 WPM realistisch ~28 s und muss durchlaufen; der Deckel
 * schützt nur gegen pathologische Blöcke (ASCII-Art, 10.000 Zeichen).
 */
const MAX_SLOT_MS = 30_000;


/**
 * „Ausreden lassen": Lesetempo-Schätzung und gemeinsame Sprech-Uhr der
 * EZ-Shell.
 *
 * Hintergrund: Die App erzeugt Sprachausgabe ausschließlich über DOM-Mutationen
 * in ARIA-Live-Regionen — es gibt KEIN „Ansage fertig"-Signal des Browsers
 * (keine Web-Speech-API, kein CDK-LiveAnnouncer). Trifft während einer
 * laufenden Ansage neue Ausgabe ein, schneidet der Screenreader die alte ab.
 * Deshalb schätzt dieser Service, wie lange ein Text voraussichtlich gesprochen
 * wird, und führt eine gemeinsame Uhr darüber, bis wann „belegt" ist.
 *
 * Die Uhr ist ein Root-Singleton, weil sich mehrere Ansage-Quellen
 * koordinieren müssen: die Live-Region (über `MudScreenReaderAnnouncer`), der
 * assertive Start-Block der Ausgabe-Komponente und der assertive
 * Modus-/Recall-Announcer der Eingabe-Komponente. Nur eine gemeinsame Instanz
 * kann wissen, dass VoiceOver gerade noch spricht.
 *
 * Default AUS — bestehende, mit Testern validierte Pfade bleiben unberührt,
 * bis der Nutzer das Häkchen „Ausreden lassen" im Footer-Menü setzt.
 */
@Injectable({ providedIn: 'root' })
export class SpeechPacingService {
  /** Reaktiver Schalter; Menü und Announcer lesen ihn. */
  public readonly enabled = signal<boolean>(false);

  /** Reaktives Lesetempo (Untermenü „Lesetempo"). */
  public readonly rate = signal<SpeechRate>(DEFAULT_RATE);

  /**
   * Zeitpunkt (ms seit Epoche), bis zu dem die zuletzt reservierte Ansage
   * voraussichtlich gesprochen wird. Vergangenheit = frei.
   */
  private busyUntil = 0;

  constructor() {
    this.enabled.set(this.loadEnabled());
    this.rate.set(this.loadRate());
  }

  private loadEnabled(): boolean {
    const raw = namespacedStorage.get(STORAGE_SUFFIX);
    return raw === '1' || raw === 'true';
  }

  private loadRate(): SpeechRate {
    const raw = namespacedStorage.get(RATE_STORAGE_SUFFIX);
    if (raw && (VALID_RATES as readonly string[]).includes(raw)) {
      return raw as SpeechRate;
    }
    return DEFAULT_RATE;
  }

  /** Synchroner Lesezugriff für den Announcer (der kein Angular kennt). */
  public isEnabled(): boolean {
    return this.enabled();
  }

  public setEnabled(enabled: boolean): void {
    this.enabled.set(enabled);
    namespacedStorage.set(STORAGE_SUFFIX, enabled ? '1' : '0');
    if (!enabled) {
      // Beim Abschalten darf keine alte Reservierung nachhängen und den
      // sofortigen Pfad blockieren.
      this.reset();
    }
  }

  /** Legt den Schalter um und liefert den neuen Zustand (fürs Menü-Häkchen). */
  public toggle(): boolean {
    const next = !this.enabled();
    this.setEnabled(next);
    return next;
  }

  public setRate(rate: SpeechRate): void {
    this.rate.set(rate);
    namespacedStorage.set(RATE_STORAGE_SUFFIX, rate);
    // Wer das Tempo umstellt, tut das meist WEIL es gerade zu träge ist.
    // Eine nach altem Tempo laufende Reservierung würde die Umstellung sonst
    // um bis zu eine volle Ansage verzögern — also Uhr freigeben.
    this.reset();
  }

  /**
   * Schätzt, wie lange ein Screenreader für `text` braucht.
   *
   * Sockel + Zeichen/Sekunde + Zeilenpausen, beidseitig gekappt. Die Schätzung
   * kann das echte Tempo nie exakt treffen (VoiceOvers Sprechrate ist aus der
   * Seite heraus nicht auslesbar) — deshalb ist das Tempo einstellbar.
   */
  public estimateMs(text: string): number {
    const wpm = SPEECH_RATE_WPM[this.rate()];
    if (!text || wpm === 0) {
      return 0;
    }
    const charsPerSecond = (wpm * CHARS_PER_WORD) / 60;
    let lineBreaks = 0;
    for (const char of text) {
      if (char === '\n') {
        lineBreaks++;
      }
    }
    const raw =
      BASE_LATENCY_MS +
      (text.length / charsPerSecond) * 1000 +
      lineBreaks * LINE_BREAK_PAUSE_MS;

    return Math.round(Math.min(Math.max(raw, MIN_SLOT_MS), MAX_SLOT_MS));
  }

  /**
   * Verbleibende Millisekunden, bis die zuletzt reservierte Ansage
   * voraussichtlich fertig ist. `0` heißt frei — dann darf sofort geschrieben
   * werden (Leerlauf-Regel, sonst fühlt sich der Client träge an).
   */
  public remainingMs(): number {
    const left = this.busyUntil - Date.now();
    return left > 0 ? left : 0;
  }

  /**
   * Meldet eine gerade abgesetzte Ansage an die gemeinsame Uhr.
   *
   * Reserviert wird AB JETZT, nicht hinter einer bestehenden Reservierung: Wer
   * `reserve` ruft, hat bereits geschrieben. Die assertiven Regionen
   * unterbrechen laufende Ansagen ohnehin, ihre Reservierung ersetzt also die
   * bisherige. Eine noch längere Reservierung wird dabei nicht verkürzt.
   */
  public reserve(durationMs: number): void {
    if (!this.isEnabled() || durationMs <= 0) {
      return;
    }
    const until = Date.now() + durationMs;
    if (until > this.busyUntil) {
      this.busyUntil = until;
    }
  }

  /** Gibt die Uhr sofort frei (bewusster Abbruch, Sitzungswechsel, Dispose). */
  public reset(): void {
    this.busyUntil = 0;
  }
}
