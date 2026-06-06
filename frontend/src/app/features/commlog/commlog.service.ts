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
 * Maps the GMCP channel name (as sent by `gmcp.c`) to the German label shown
 * in the output and the download. Unknown channels fall back to the raw name.
 */
const CHANNEL_LABELS: Record<string, string> = {
  Say: 'sage',
  Soul: 'seele',
  Tell: 'rede',
};

/** Returns the German display label for a channel, or the raw name. */
export function channelLabel(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel;
}

/**
 * Collects all `Comm.Say` / `Comm.Soul` / `Comm.Tell` messages into an
 * in-memory buffer for the CommLog window.
 */
@Injectable({ providedIn: 'root' })
export class CommlogService implements OnDestroy {
  private readonly signals = inject(MudSignalService);

  /** Reactive buffer of collected messages (oldest first). */
  public readonly entries = signal<CommlogEntry[]>([]);

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
        return `[${time}] (${channelLabel(e.channel)}) ${e.player}: ${e.text}`;
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
}
