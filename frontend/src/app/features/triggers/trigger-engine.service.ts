import { inject, Injectable, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

import { dropOverlaps, injectHighlights, stripAnsi } from './ansi-injector';
import type {
  HighlightSegment,
  SoundPlay,
  TriggerResult,
} from './models/highlight';
import { compileTrigger, type Trigger } from './models/trigger';
import { TriggerService } from './trigger.service';

/** Maximum matches collected per trigger per chunk — guards against `gi` runaway. */
const MAX_MATCHES_PER_TRIGGER = 32;

/** Soft watchdog for total matching time, in milliseconds. */
const WATCHDOG_BUDGET_MS = 200;

interface CompiledTrigger {
  trigger: Trigger;
  regex: RegExp;
}

/**
 * Runs the user's triggers against MUD output and produces an ANSI-highlighted
 * version of the text plus the sounds to play.
 *
 * Patterns are compiled once on every trigger-list change and cached. Invalid
 * patterns are logged and skipped — the user-facing UI is expected to refuse
 * such patterns at save time, so reaching this branch indicates corrupted
 * persistence.
 *
 * Matching happens in *visible* coordinates (ANSI codes stripped), then
 * highlights are projected back into the original byte stream so the
 * server's own colours stay intact around the match.
 */
@Injectable({ providedIn: 'root' })
export class TriggerEngineService implements OnDestroy {
  private readonly triggerService = inject(TriggerService);

  private compiled: CompiledTrigger[] = [];
  private readonly subscriptions: Subscription[] = [];

  constructor() {
    this.subscriptions.push(
      this.triggerService.triggers$.subscribe((list) => this.recompile(list)),
    );
  }

  ngOnDestroy(): void {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
  }

  /**
   * Processes a chunk of MUD output. Returns the ANSI-highlighted version of
   * the chunk and the sounds the caller should play.
   *
   * The chunk *may* contain multiple lines, embedded ANSI codes or both.
   * Matches that span a chunk boundary (i.e. the line is split across two
   * server emissions) are not detected — a known limitation; in practice
   * the MUD sends a line in a single chunk.
   */
  public processChunk(text: string): TriggerResult {
    if (text.length === 0 || this.compiled.length === 0) {
      return { text, sounds: [] };
    }

    const settings = this.triggerService.settings;
    if (!settings.globallyEnabled) {
      return { text, sounds: [] };
    }

    const visible = stripAnsi(text);
    if (visible.length === 0) {
      return { text, sounds: [] };
    }

    const highlights: HighlightSegment[] = [];
    const sounds: SoundPlay[] = [];

    const deadline = nowMs() + WATCHDOG_BUDGET_MS;

    for (const ct of this.compiled) {
      if (!ct.trigger.enabled) {
        continue;
      }
      if (nowMs() > deadline) {
        console.warn(
          '[TriggerEngine] Watchdog hit — skipping remaining triggers for this chunk',
        );
        break;
      }

      // `lastIndex` is per-regex state; reset so a previous chunk's leftover
      // position doesn't skip the start of the new one.
      ct.regex.lastIndex = 0;

      let count = 0;
      let m: RegExpExecArray | null;
      while ((m = ct.regex.exec(visible)) !== null) {
        if (m[0].length === 0) {
          // Zero-width match — advance manually to avoid infinite loop.
          ct.regex.lastIndex = m.index + 1;
          continue;
        }

        count++;
        if (count > MAX_MATCHES_PER_TRIGGER) {
          break;
        }

        const start = m.index;
        const end = m.index + m[0].length;

        const action = ct.trigger.action;
        if (action.kind === 'highlight') {
          highlights.push({
            start,
            end,
            foreground: action.foreground,
            background: action.background,
            bold: action.bold,
          });
        } else {
          sounds.push({
            soundId: action.soundId,
            volume: action.volume,
          });
        }
      }
    }

    if (highlights.length === 0) {
      return { text, sounds };
    }

    const resolved = dropOverlaps(highlights);
    const injected = injectHighlights(text, resolved);
    return { text: injected, sounds };
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private recompile(list: readonly Trigger[]): void {
    const next: CompiledTrigger[] = [];

    for (const t of list) {
      const r = compileTrigger(t.pattern, t.flags);
      if (r.ok) {
        next.push({ trigger: t, regex: r.regex });
      } else {
        console.warn(
          `[TriggerEngine] Skipping invalid trigger "${t.name}" (${t.id}): ${r.error}`,
        );
      }
    }

    this.compiled = next;
  }
}

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}
