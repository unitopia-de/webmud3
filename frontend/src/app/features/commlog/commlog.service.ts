import { inject, Injectable, OnDestroy, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import { MudSignalService } from '@webmud3/frontend/features/gmcp/signals/mud-signal.service';

/**
 * A single collected communication line.
 */
export interface CommlogEntry {
  /** Receive time (epoch millis), used for the timestamp column + sort. */
  timestamp: number;
  /** Channel as reported by the MUD: "Say", "Soul" or "Tell". */
  channel: string;
  /** The originating player (or "-" if the MUD didn't supply one). */
  player: string;
  /** The message text. */
  text: string;
}

/** Hard cap so a long session can't grow the buffer without bound. */
const MAX_ENTRIES = 5000;

/**
 * Collects all `Comm.Say` / `Comm.Soul` / `Comm.Tell` messages into an
 * in-memory buffer for the experimental CommLog window.
 *
 * The feature as a whole is gated behind the `?commlog=1` query parameter:
 * `enabled` reflects that flag. When the feature is off the MUD never sends
 * Comm.* (the "Comm" GMCP module is not registered), so the subscription
 * simply stays empty — there is no harm in always listening.
 */
@Injectable({ providedIn: 'root' })
export class CommlogService implements OnDestroy {
  private readonly signals = inject(MudSignalService);

  /** Reactive buffer of collected messages (oldest first). */
  public readonly entries = signal<CommlogEntry[]>([]);

  /**
   * Whether the CommLog feature was switched on via `?commlog=1`.
   * Read once at construction; dependency-free (no router) so it works
   * regardless of which shell route is active — mirrors PerfHudService.
   */
  public readonly enabled = this.readEnabledFlag();

  private readonly subscription: Subscription;

  constructor() {
    this.subscription = this.signals.on('Comm.Message').subscribe((s) => {
      this.append(s.channel, s.data);
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  /** Empties the buffer. */
  public clear(): void {
    this.entries.set([]);
  }

  /**
   * Renders the current buffer as a plain-text log, one line per message:
   * `[HH:MM:SS] (Channel) Player: text`
   */
  public toText(): string {
    return this.entries()
      .map((e) => {
        const time = new Date(e.timestamp).toLocaleTimeString('de-DE');
        return `[${time}] (${e.channel}) ${e.player}: ${e.text}`;
      })
      .join('\n');
  }

  private append(channel: string, data: unknown): void {
    const d = (data ?? {}) as Record<string, unknown>;

    const entry: CommlogEntry = {
      timestamp: Date.now(),
      channel,
      player: typeof d['player'] === 'string' ? (d['player'] as string) : '-',
      text: typeof d['text'] === 'string' ? (d['text'] as string) : '',
    };

    this.entries.update((list) => {
      const next = [...list, entry];
      // Keep only the most recent MAX_ENTRIES so memory stays bounded.
      return next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next;
    });
  }

  private readEnabledFlag(): boolean {
    try {
      return new URLSearchParams(window.location.search).get('commlog') === '1';
    } catch {
      return false;
    }
  }
}
