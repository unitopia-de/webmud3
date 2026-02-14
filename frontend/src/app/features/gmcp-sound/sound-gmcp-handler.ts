import { inject, Injectable } from '@angular/core';

import { GmcpService } from '../gmcp/gmcp.service';
import type { GmcpMenuItem, GmcpModuleHandler } from '../gmcp/gmcp-module-handler';

/**
 * GMCP handler for the `Sound` module.
 *
 * Handles:
 * - `Sound.Url`   → Stores the base URL for sound files
 * - `Sound.Event` → Plays a sound file via HTML5 Audio API
 *
 * Toggle:
 * - When enabled:  sends `Core.Supports.Add ["Sound 1"]`
 * - When disabled: sends `Core.Supports.Remove ["Sound 1"]`
 *
 * The MUD sends `Sound.Url` once after GMCP start, providing the base URL
 * (e.g. `https://unitopia.de/mudlet/sounds`). Then `Sound.Event` messages
 * contain just the filename (e.g. `{ file: "door_open.mp3" }`), and we
 * concatenate: `baseUrl + "/" + file`.
 *
 * No backend changes needed — GMCP sound messages are transparently forwarded.
 */
@Injectable({ providedIn: 'root' })
export class SoundGmcpHandler implements GmcpModuleHandler {
  readonly moduleName = 'Sound';
  readonly version = '1';

  private readonly gmcpService = inject(GmcpService);

  /** Base URL for sound files, set by `Sound.Url` */
  private baseUrl = '';

  /** Whether sound is currently enabled */
  private enabled = true;

  /**
   * Routes incoming GMCP `Sound.*` messages.
   */
  handleMessage(message: string, data: unknown): void {
    const msgLower = message.toLowerCase().trim();

    switch (msgLower) {
      case 'url':
        this.handleSoundUrl(data as { url: string });
        break;

      case 'event':
        this.handleSoundEvent(data as { file: string });
        break;

      default:
        console.debug(`[SoundGmcpHandler] Unknown message: Sound.${message}`, data);
    }
  }

  /**
   * Returns a menu item for toggling sound on/off.
   */
  getMenuItems(): GmcpMenuItem[] {
    return [
      {
        label: 'Vertonung',
        tooltip: this.enabled ? 'Sound ausschalten' : 'Sound einschalten',
        checked: this.enabled,
        action: () => this.toggle(),
      },
    ];
  }

  /**
   * Toggles sound on or off.
   *
   * When enabling:  sends `Core.Supports.Add ["Sound 1"]`
   * When disabling: sends `Core.Supports.Remove ["Sound 1"]`
   */
  public toggle(): void {
    this.enabled = !this.enabled;

    if (this.enabled) {
      this.gmcpService.sendOutgoing('Core', 'Supports.Add', ['Sound 1']);
      console.info('[SoundGmcpHandler] Sound enabled.');
    } else {
      this.gmcpService.sendOutgoing('Core', 'Supports.Remove', ['Sound 1']);
      console.info('[SoundGmcpHandler] Sound disabled.');
    }
  }

  /** Whether sound is currently enabled */
  public get isEnabled(): boolean {
    return this.enabled;
  }

  /** The current base URL for sound files */
  public get soundBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Cleanup when module is unregistered.
   */
  dispose(): void {
    this.baseUrl = '';
    this.enabled = true;

    console.info('[SoundGmcpHandler] Disposed.');
  }

  /**
   * Handles `Sound.Url`: stores the base URL for sound files.
   */
  private handleSoundUrl(data: { url: string }): void {
    this.baseUrl = data.url ?? '';

    console.info('[SoundGmcpHandler] Sound base URL set:', this.baseUrl);
  }

  /**
   * Handles `Sound.Event`: plays a sound file.
   *
   * Uses HTML5 Audio API — simple, no Web Audio API needed.
   * Playback is fire-and-forget; errors are logged but not thrown.
   */
  private handleSoundEvent(data: { file: string }): void {
    if (!this.enabled) {
      console.debug('[SoundGmcpHandler] Sound disabled, skipping:', data.file);
      return;
    }

    if (this.baseUrl === '') {
      console.warn('[SoundGmcpHandler] No base URL set, cannot play:', data.file);
      return;
    }

    const soundUrl = `${this.baseUrl}/${data.file}`;

    try {
      const audio = new Audio(soundUrl);
      audio.load();

      audio.play().catch((err) => {
        // Browser may block autoplay — log but don't crash
        console.warn('[SoundGmcpHandler] Playback failed (autoplay policy?):', soundUrl, err);
      });

      console.debug('[SoundGmcpHandler] Playing:', soundUrl);
    } catch (err) {
      console.error('[SoundGmcpHandler] Failed to create audio:', soundUrl, err);
    }
  }
}
