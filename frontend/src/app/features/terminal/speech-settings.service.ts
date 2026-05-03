import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, map, Observable } from 'rxjs';

import { namespacedStorage } from '@webmud3/frontend/shared/utils/storage-namespace';

/**
 * Persisted shape of the speech settings. Defined as a separate type so we
 * have a single place where defaults and serialization live.
 */
type SpeechSettings = {
  /** Announce each word as soon as the user types whitespace. */
  announceInputWord: boolean;
  /** Announce the full committed input line after Enter. */
  announceInputCommit: boolean;
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
  announceInputWord: true,
  announceInputCommit: true,
  politeInputMode: false,
};

const STORAGE_SUFFIX = 'webmud3-speech-settings';

/**
 * Runtime-toggleable speech / aria-live announcer settings.
 *
 * Mirrors the `DebugSettingsService` pattern but adds persistence so the
 * user's choices survive reloads. Storage is namespaced per deployment
 * (Webmud3 vs. webmud3test) so prod and test instances stay independent.
 *
 * Each flag is exposed both as an Observable (for components / menu state)
 * and as a synchronous getter (for the non-Angular `MudScreenReaderAnnouncer`
 * helper, which receives the getters as callbacks).
 */
@Injectable({ providedIn: 'root' })
export class SpeechSettingsService {
  private readonly announceInputWordSubject = new BehaviorSubject<boolean>(
    DEFAULTS.announceInputWord,
  );
  private readonly announceInputCommitSubject = new BehaviorSubject<boolean>(
    DEFAULTS.announceInputCommit,
  );
  private readonly politeInputModeSubject = new BehaviorSubject<boolean>(
    DEFAULTS.politeInputMode,
  );

  public readonly announceInputWord$ =
    this.announceInputWordSubject.asObservable();
  public readonly announceInputCommit$ =
    this.announceInputCommitSubject.asObservable();
  public readonly politeInputMode$ =
    this.politeInputModeSubject.asObservable();

  /**
   * Convenience stream emitting the full settings object whenever any flag
   * changes. Components can subscribe to refresh their UI state in one go.
   */
  public readonly settings$: Observable<SpeechSettings> = combineLatest([
    this.announceInputWord$,
    this.announceInputCommit$,
    this.politeInputMode$,
  ]).pipe(
    map(([announceInputWord, announceInputCommit, politeInputMode]) => ({
      announceInputWord,
      announceInputCommit,
      politeInputMode,
    })),
  );

  constructor() {
    this.loadFromStorage();
  }

  public get announceInputWord(): boolean {
    return this.announceInputWordSubject.value;
  }

  public get announceInputCommit(): boolean {
    return this.announceInputCommitSubject.value;
  }

  public get politeInputMode(): boolean {
    return this.politeInputModeSubject.value;
  }

  public setAnnounceInputWord(enabled: boolean): void {
    if (this.announceInputWordSubject.value !== enabled) {
      this.announceInputWordSubject.next(enabled);
      this.persist();
    }
  }

  public setAnnounceInputCommit(enabled: boolean): void {
    if (this.announceInputCommitSubject.value !== enabled) {
      this.announceInputCommitSubject.next(enabled);
      this.persist();
    }
  }

  public setPoliteInputMode(enabled: boolean): void {
    if (this.politeInputModeSubject.value !== enabled) {
      this.politeInputModeSubject.next(enabled);
      this.persist();
    }
  }

  public toggleAnnounceInputWord(): boolean {
    const next = !this.announceInputWordSubject.value;
    this.setAnnounceInputWord(next);
    return next;
  }

  public toggleAnnounceInputCommit(): boolean {
    const next = !this.announceInputCommitSubject.value;
    this.setAnnounceInputCommit(next);
    return next;
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

      if (typeof parsed.announceInputWord === 'boolean') {
        this.announceInputWordSubject.next(parsed.announceInputWord);
      }
      if (typeof parsed.announceInputCommit === 'boolean') {
        this.announceInputCommitSubject.next(parsed.announceInputCommit);
      }
      if (typeof parsed.politeInputMode === 'boolean') {
        this.politeInputModeSubject.next(parsed.politeInputMode);
      }
    } catch (err) {
      console.warn('[SpeechSettings] Failed to parse stored settings', err);
    }
  }

  private persist(): void {
    const snapshot: SpeechSettings = {
      announceInputWord: this.announceInputWordSubject.value,
      announceInputCommit: this.announceInputCommitSubject.value,
      politeInputMode: this.politeInputModeSubject.value,
    };

    namespacedStorage.set(STORAGE_SUFFIX, JSON.stringify(snapshot));
  }
}
