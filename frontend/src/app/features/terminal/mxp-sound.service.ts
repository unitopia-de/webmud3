import { inject, Injectable } from '@angular/core';

import { SoundService } from '@webmud3/frontend/features/sound/sound.service';

/**
 * Plays sound effects pushed via MXP `<sound>` tags.
 *
 * UNItopia emits two flavours of the tag:
 *   - `<sound Off U="https://www.unitopia.de/sound">` during init_mxp() —
 *     announces the base URL where sound files live, and indicates the
 *     server expects sound output to be initially muted (`Off`). We use
 *     the URL; the muted hint is honoured indirectly via the user's
 *     `SoundService.enabled` toggle.
 *   - `<sound "kampf/treffer.mp3">` inline before a regular text message —
 *     plays the named file, joined onto the cached base URL.
 *
 * Coordination with GMCP-Sound:
 *   - When the GMCP `Sound` package is active (we have received a
 *     `Sound.Url`), GMCP and MXP often duplicate the same effect. To avoid
 *     hearing it twice we ignore MXP-sound while GMCP-sound is active;
 *     `SoundService.gmcpActive` exposes that signal.
 *   - The user-facing "Sound" toggle (`SoundService.enabled`) controls
 *     **both** sources: this service delegates the actual playback to
 *     `SoundService.play(absoluteUrl)`, which does the toggle check
 *     and the audio caching.
 */
@Injectable({ providedIn: 'root' })
export class MxpSoundService {
  private readonly sound = inject(SoundService);

  /** Last URL prefix announced via `<sound Off U="…">`. */
  private baseUrl = '';

  public setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  /**
   * Resolves and plays a sound from an inline `<sound "file">` tag —
   * unless GMCP-sound is active (in which case it would already produce
   * audio, so we step out of the way to prevent doubled effects).
   */
  public playEvent(file: string): void {
    if (!file) {
      return;
    }
    if (this.sound.gmcpActive) {
      return;
    }
    const url = this.resolveUrl(file);
    this.sound.play(url);
  }

  public clear(): void {
    this.baseUrl = '';
  }

  /**
   * Joins an inline `<sound>` filename onto the cached base URL. Returns
   * the input unchanged when it already looks absolute (`http://` /
   * `https://`) or when no base URL has been received yet — the
   * SoundService will then attempt to play it as-is.
   */
  private resolveUrl(file: string): string {
    if (/^https?:\/\//i.test(file)) {
      return file;
    }
    if (this.baseUrl === '') {
      return file;
    }
    const baseHasSlash = this.baseUrl.endsWith('/');
    const fileHasSlash = file.startsWith('/');
    if (baseHasSlash && fileHasSlash) {
      return this.baseUrl + file.slice(1);
    }
    if (!baseHasSlash && !fileHasSlash) {
      return `${this.baseUrl}/${file}`;
    }
    return this.baseUrl + file;
  }
}
