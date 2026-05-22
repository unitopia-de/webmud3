import { inject, Injectable, OnDestroy } from '@angular/core';

import { SoundLibraryService } from './sound-library.service';
import { TriggerService } from './trigger.service';

/** Minimum gap between two playbacks of the same sound id, in milliseconds. */
const DEBOUNCE_MS = 250;

/**
 * Plays trigger-driven sounds.
 *
 * Uses cached `HTMLAudioElement` instances keyed by their resolved URL,
 * mirroring the existing GMCP `SoundService` pattern. Web Audio API would
 * give finer mixing control but is overkill for the trigger use case where
 * a single short sound plays at a time.
 *
 * Volume = master (from TriggerService.settings) × per-trigger volume
 * (defaults to 1). Both are clamped to [0, 1].
 *
 * Debouncing prevents the same trigger from spamming the speakers if a
 * regex matches many times per line.
 */
@Injectable({ providedIn: 'root' })
export class SoundPlayerService implements OnDestroy {
  private readonly library = inject(SoundLibraryService);
  private readonly triggers = inject(TriggerService);

  private readonly audioCache = new Map<string, HTMLAudioElement>();
  private readonly lastPlayedAt = new Map<string, number>();

  ngOnDestroy(): void {
    for (const audio of this.audioCache.values()) {
      audio.pause();
      audio.src = '';
    }
    this.audioCache.clear();
    this.lastPlayedAt.clear();
  }

  /**
   * Plays the sound referenced by a namespaced id.
   *
   * No-op when:
   *   - the trigger system is globally disabled,
   *   - master or effective volume is zero,
   *   - the sound id can't be resolved,
   *   - the same id was played less than {@link DEBOUNCE_MS} ms ago.
   *
   * Returns `true` if playback was actually started.
   */
  public play(soundId: string, perTriggerVolume?: number): boolean {
    const settings = this.triggers.settings;

    if (!settings.globallyEnabled) {
      return false;
    }

    const effectiveVolume = clamp01(settings.masterVolume) *
      clamp01(perTriggerVolume ?? 1);

    if (effectiveVolume === 0) {
      return false;
    }

    const url = this.library.resolveUrl(soundId);
    if (url === null) {
      console.warn(`[SoundPlayer] Unknown sound id: ${soundId}`);
      return false;
    }

    const now = Date.now();
    const last = this.lastPlayedAt.get(soundId);
    if (last !== undefined && now - last < DEBOUNCE_MS) {
      return false;
    }
    this.lastPlayedAt.set(soundId, now);

    const audio = this.getOrCreateAudio(url);
    audio.volume = effectiveVolume;
    audio.currentTime = 0;

    audio.play().catch((err: unknown) => {
      // Autoplay policy: the first play() before any user gesture rejects
      // with NotAllowedError. The existing GMCP SoundService takes the same
      // silent approach — once the user clicks/types, later plays succeed.
      console.debug('[SoundPlayer] play() rejected for', url, err);
    });

    return true;
  }

  /** Stops anything currently playing — used when the user mutes mid-playback. */
  public stopAll(): void {
    for (const audio of this.audioCache.values()) {
      if (!audio.paused) {
        audio.pause();
        audio.currentTime = 0;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private getOrCreateAudio(url: string): HTMLAudioElement {
    let audio = this.audioCache.get(url);

    if (audio === undefined) {
      audio = new Audio(url);
      audio.preload = 'auto';
      this.audioCache.set(url, audio);
    }

    return audio;
  }
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) {
    return 0;
  }
  return Math.max(0, Math.min(1, v));
}
