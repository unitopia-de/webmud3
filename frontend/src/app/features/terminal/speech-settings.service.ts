import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { namespacedStorage } from '@webmud3/frontend/shared/utils/storage-namespace';

/**
 * Persisted shape of the speech settings. Defined as a separate type so we
 * have a single place where defaults and serialization live.
 */
type SpeechSettings = {
  /**
   * Use `aria-live="polite"` instead of `assertive` for the input region.
   * Works around a VoiceOver/Safari bug where assertive updates next to a
   * polite log region trigger a complete re-read of the log on every
   * commit. Polite avoids the cross-region interference but loses the
   * "interrupt current speech" behaviour.
   */
  politeInputMode: boolean;
};

const DEFAULTS: SpeechSettings = {
  politeInputMode: false,
};

const STORAGE_SUFFIX = 'webmud3-speech-settings';

/**
 * Runtime-toggleable speech / aria-live announcer settings. Currently only
 * exposes the polite-input-mode flag; per-word and per-line announcements were
 * removed because the default screen reader behaviour (helper textarea +
 * auto-clearing live log region) covers the same need without cross-region
 * interference.
 */
@Injectable({ providedIn: 'root' })
export class SpeechSettingsService {
  private readonly politeInputModeSubject = new BehaviorSubject<boolean>(
    DEFAULTS.politeInputMode,
  );

  public readonly politeInputMode$ =
    this.politeInputModeSubject.asObservable();

  constructor() {
    this.loadFromStorage();
  }

  public get politeInputMode(): boolean {
    return this.politeInputModeSubject.value;
  }

  public setPoliteInputMode(enabled: boolean): void {
    if (this.politeInputModeSubject.value !== enabled) {
      this.politeInputModeSubject.next(enabled);
      this.persist();
    }
  }

  public togglePoliteInputMode(): boolean {
    const next = !this.politeInputModeSubject.value;
    this.setPoliteInputMode(next);
    return next;
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  private loadFromStorage(): void {
    const raw = namespacedStorage.get(STORAGE_SUFFIX);

    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<SpeechSettings>;

      if (typeof parsed.politeInputMode === 'boolean') {
        this.politeInputModeSubject.next(parsed.politeInputMode);
      }
    } catch (err) {
      console.warn('[SpeechSettings] Failed to parse stored settings', err);
    }
  }

  private persist(): void {
    const snapshot: SpeechSettings = {
      politeInputMode: this.politeInputModeSubject.value,
    };

    namespacedStorage.set(STORAGE_SUFFIX, JSON.stringify(snapshot));
  }
}
