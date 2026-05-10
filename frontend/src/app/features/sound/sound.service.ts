import { inject, Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';

import { MudSignalService } from '@webmud3/frontend/features/gmcp/signals/mud-signal.service';
import { namespacedStorage } from '@webmud3/frontend/shared/utils/storage-namespace';
import { SoundGmcpModule } from './sound-gmcp.module';

const STORAGE_SUFFIX = 'webmud3-sound-enabled';

/**
 * Plays MUD-driven sound effects.
 *
 * Two GMCP messages drive this:
 *   - `Sound.Url` is sent once when the `Sound` package is registered. It
 *     announces the base URL where sound files are hosted; the service
 *     remembers it and uses it as the prefix for any subsequent file name.
 *   - `Sound.Event` is sent for in-game audio events (combat hits, room
 *     ambience, …). It carries a relative file name; the service composes
 *     the playable URL by joining base + file.
 *
 * Browser autoplay policy: `<audio>.play()` is rejected until the user has
 * interacted with the page at least once. The service silently ignores those
 * rejections — once the user has typed in the terminal, sounds work.
 */
@Injectable({ providedIn: 'root' })
export class SoundService implements OnDestroy {
  private readonly signals = inject(MudSignalService);
  // Bootstraps the GMCP "Sound" registration as a side-effect of inject.
  private readonly _soundGmcp = inject(SoundGmcpModule);

  private readonly subscriptions: Subscription[] = [];

  /** Last `Sound.Url` announcement; used as a prefix for relative event files. */
  private baseUrl = '';

  /**
   * True once a GMCP `Sound.Url` has been received in the current session.
   * Used by the MXP-sound consumer to suppress its own playback whenever
   * GMCP would already be playing the same effect — see MxpSoundService.
   */
  public get gmcpActive(): boolean {
    return this.baseUrl !== '';
  }

  /** Clears the GMCP-side state — call on disconnect / reconnect. */
  public gmcpReset(): void {
    this.baseUrl = '';
  }

  /**
   * Cache of preloaded `HTMLAudioElement`s, keyed by their fully-resolved URL.
   * Reusing them avoids re-decoding identical sounds and keeps memory bounded.
   */
  private readonly audioCache = new Map<string, HTMLAudioElement>();

  /**
   * Reactive on/off switch. Defaults to enabled but can be toggled by the
   * user via the footer menu; the choice is persisted per deployment so it
   * survives reloads.
   */
  private readonly enabledSubject = new BehaviorSubject<boolean>(true);
  public readonly enabled$: Observable<boolean> =
    this.enabledSubject.asObservable();

  constructor() {
    this.loadEnabledFromStorage();

    this.subscriptions.push(
      this.signals.on('Sound.Url').subscribe((s) => {
        this.baseUrl = s.url;
        console.info('[Sound] Base URL announced:', s.url);
      }),
      this.signals.on('Sound.Event').subscribe((s) => {
        this.play(s.file);
      }),
    );
  }

  ngOnDestroy(): void {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }

    for (const audio of this.audioCache.values()) {
      audio.pause();
      audio.src = '';
    }
    this.audioCache.clear();
  }

  /** Synchronous read for non-Angular consumers. */
  public get enabled(): boolean {
    return this.enabledSubject.value;
  }

  public setEnabled(enabled: boolean): void {
    if (this.enabledSubject.value === enabled) {
      return;
    }
    this.enabledSubject.next(enabled);
    this.persistEnabled();

    // Stop everything that is currently audible when the user mutes.
    if (!enabled) {
      this.stopAllPlaying();
    }
  }

  public toggle(): boolean {
    const next = !this.enabledSubject.value;
    this.setEnabled(next);
    return next;
  }

  /**
   * Plays the given sound. The argument is the relative file name from
   * `Sound.Event`; absolute URLs (already containing `://`) are passed through
   * unchanged. No-op when sound output is disabled by the user.
   */
  public play(fileOrUrl: string): void {
    if (!fileOrUrl) {
      return;
    }
    if (!this.enabledSubject.value) {
      return;
    }

    const url = this.resolveUrl(fileOrUrl);
    const audio = this.getOrCreateAudio(url);

    // Restart from the beginning so a sound retriggered while still playing
    // is heard again, not dropped.
    audio.currentTime = 0;

    audio.play().catch((err: unknown) => {
      // The most common reason here is the browser autoplay policy — the
      // first play() before any user gesture rejects with NotAllowedError.
      // We don't surface this; once the user types or clicks, subsequent
      // calls succeed.
      console.debug('[Sound] play() rejected for', url, err);
    });
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private resolveUrl(fileOrUrl: string): string {
    if (/^https?:\/\//i.test(fileOrUrl)) {
      return fileOrUrl;
    }

    if (this.baseUrl === '') {
      return fileOrUrl;
    }

    const baseHasSlash = this.baseUrl.endsWith('/');
    const fileHasSlash = fileOrUrl.startsWith('/');

    if (baseHasSlash && fileHasSlash) {
      return this.baseUrl + fileOrUrl.slice(1);
    }

    if (!baseHasSlash && !fileHasSlash) {
      return `${this.baseUrl}/${fileOrUrl}`;
    }

    return this.baseUrl + fileOrUrl;
  }

  private getOrCreateAudio(url: string): HTMLAudioElement {
    let audio = this.audioCache.get(url);

    if (audio === undefined) {
      audio = new Audio(url);
      audio.preload = 'auto';
      this.audioCache.set(url, audio);
    }

    return audio;
  }

  /** Pauses every cached `<audio>` so muting takes effect mid-playback. */
  private stopAllPlaying(): void {
    for (const audio of this.audioCache.values()) {
      if (!audio.paused) {
        audio.pause();
        audio.currentTime = 0;
      }
    }
  }

  private loadEnabledFromStorage(): void {
    const raw = namespacedStorage.get(STORAGE_SUFFIX);
    if (raw === '0' || raw === 'false') {
      this.enabledSubject.next(false);
    }
    // Anything else (including the default empty key) keeps the initial
    // `true` value — sound is on out of the box.
  }

  private persistEnabled(): void {
    namespacedStorage.set(STORAGE_SUFFIX, this.enabledSubject.value ? '1' : '0');
  }
}
