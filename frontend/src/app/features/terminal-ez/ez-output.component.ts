import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { Subscription } from 'rxjs';

import { MudService } from '@webmud3/frontend/core/mud/services/mud.service';
import { DebugSettingsService } from '@webmud3/frontend/features/debug/debug-settings.service';
import {
  MudScreenReaderAnnouncer,
  MxpStreamFilter,
  MxpTagRouter,
  TerminalThemeService,
} from '@webmud3/frontend/features/terminal';
import { OutputJumpService } from '@webmud3/frontend/features/terminal/output-jump.service';
import {
  SoundPlayerService as TriggerSoundPlayerService,
  TriggerEngineService,
} from '@webmud3/frontend/features/triggers';

/**
 * Read-only xterm output panel for the EZ-Shell (`/ez`).
 *
 * The whole reason `/ez` exists is to dodge the Mac-Safari freezes caused by
 * the xterm helper-textarea. To make that dodge effective we open xterm with
 * `disableStdin: true` and never register an `onData` handler — the terminal
 * becomes a pure display surface. Input is handled by `EzInputComponent`.
 *
 * Output pipeline (Phase 6 — feature parity with the classic shell):
 *   1. Server chunk arrives via `MudService.mudOutput$`.
 *   2. `MxpStreamFilter` splits the chunk into text / clickable segments
 *      and routes MXP tags to `MxpTagRouter` (entity / stat / element
 *      updates flow into the shared root-singleton services).
 *   3. For each text segment, `TriggerEngineService.processChunk` produces
 *      the ANSI-highlighted output text plus any sounds the user's triggers
 *      asked for; sounds go through `triggerSoundPlayer.play(...)`.
 *   4. Both text and clickable-segment content land in xterm via
 *      `terminal.write`. Clickable segments are written as plain text —
 *      no OSC 8 hyperlink wrapping, because the EZ audience interacts via
 *      keyboard / AT, not mouse clicks on MXP regions.
 *   5. The MXP-cleaned aggregate is announced via the screen reader and
 *      appended to the SR history region (H-key navigation).
 *
 * Output jump (Ctrl+End / Cmd+End, footer button "Sprung zum Ende"):
 *   `OutputJumpService.jump$` triggers `terminal.scrollToBottom()` and
 *   drains the SR queue via `stopAnnouncements()`. The SR history is
 *   intentionally left intact so the user can still navigate backwards
 *   with the H key after a jump.
 */
@Component({
  selector: 'app-ez-output',
  standalone: true,
  templateUrl: './ez-output.component.html',
  styleUrls: ['./ez-output.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EzOutputComponent implements AfterViewInit, OnDestroy {
  private readonly mudService = inject(MudService);
  private readonly terminalThemes = inject(TerminalThemeService);
  private readonly debugSettings = inject(DebugSettingsService);
  private readonly mxpRouter = inject(MxpTagRouter);
  private readonly triggerEngine = inject(TriggerEngineService);
  private readonly triggerSoundPlayer = inject(TriggerSoundPlayerService);
  private readonly outputJump = inject(OutputJumpService);

  @ViewChild('terminalRef', { static: true })
  private readonly terminalRef!: ElementRef<HTMLDivElement>;

  @ViewChild('liveRegionRef', { static: true })
  private readonly liveRegionRef!: ElementRef<HTMLDivElement>;

  @ViewChild('historyRegionRef', { static: true })
  private readonly historyRegionRef!: ElementRef<HTMLElement>;

  private terminal!: Terminal;
  private readonly fitAddon = new FitAddon();
  private screenReader?: MudScreenReaderAnnouncer;

  // Per-shell filter instance: the EZ shell and the Classic shell each
  // need their own state because xterm chunk boundaries (and therefore
  // pending-tag / pending-CSI buffers) are not shared. The tag callback
  // routes through the root-singleton MxpTagRouter so entity / stat
  // updates land in the same shared services regardless of which shell
  // produced them.
  private readonly mxpFilter = new MxpStreamFilter((raw) =>
    this.mxpRouter.handle(raw),
  );

  private subscriptions = new Subscription();
  private resizeListener?: () => void;
  private keydownListener?: (event: KeyboardEvent) => void;

  ngAfterViewInit(): void {
    const initialTheme = this.terminalThemes.theme;

    this.terminal = new Terminal({
      fontFamily: 'JetBrainsMono, monospace',
      disableStdin: true,
      screenReaderMode: false,
      theme: initialTheme.theme,
      minimumContrastRatio: initialTheme.minimumContrastRatio,
    });

    this.terminal.open(this.terminalRef.nativeElement);
    this.terminal.loadAddon(this.fitAddon);

    try {
      this.fitAddon.fit();
    } catch {
      // Initial fit can throw if the host is hidden — re-fits happen on resize.
    }

    this.screenReader = new MudScreenReaderAnnouncer(
      this.liveRegionRef.nativeElement,
      this.historyRegionRef.nativeElement,
      () => this.debugSettings.screenReaderLogging,
    );

    this.subscriptions.add(
      this.mudService.mudOutput$.subscribe(({ data }) => {
        this.transformAndWrite(data);
      }),
    );

    // Reset the announcement session AND the MXP filter on (re)connect so
    // a stale partial tag from a previous session doesn't linger across
    // a reconnect and confuse the next chunk. Mirrors what MudClient does
    // for the Classic shell.
    this.subscriptions.add(
      this.mudService.mudConnect$.subscribe(() => {
        this.mxpFilter.reset();
        this.screenReader?.markSessionStart(Date.now());
      }),
    );

    // Belt-and-braces: also reset on every disconnect edge, mirroring
    // MudClient's behaviour. Catches the case where the user is dropped
    // mid-tag and the next connection re-opens before mudConnect$ fires.
    this.subscriptions.add(
      this.mudService.connectedToMud$.subscribe((connected) => {
        if (!connected) {
          this.mxpFilter.reset();
        }
      }),
    );

    // Wire the "jump to current output" trigger (footer button +
    // Ctrl+End / Cmd+End shortcut) to xterm scrolling and SR queue
    // draining. The SR history region is left untouched on purpose so
    // the user can still walk old output via the H key.
    this.subscriptions.add(
      this.outputJump.jump$.subscribe(() => this.jumpToCurrentOutput()),
    );

    // Window-level keyboard shortcut. xterm's attachCustomKeyEventHandler
    // would be useless here because disableStdin=true means xterm never
    // owns the focus in EZ mode; the user's actual focus lives in the
    // native <textarea> below. A `keydown` listener at the window level
    // catches the shortcut wherever the focus is.
    this.keydownListener = (event) => this.handleGlobalKeydown(event);
    window.addEventListener('keydown', this.keydownListener);

    this.resizeListener = () => {
      try {
        this.fitAddon.fit();
      } catch {
        // ignore — see comment above
      }
    };
    window.addEventListener('resize', this.resizeListener);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
    }
    this.screenReader?.dispose();
    this.terminal?.dispose();
  }

  /**
   * Writes a locally-echoed user line into the terminal so the user sees
   * what they just sent. Mirrors `MudClientComponent.onMobileInputCommit`:
   * append CRLF so the next server output starts on a fresh line, and feed
   * the line into the screen-reader history so AT keeps the verbatim
   * transcript.
   *
   * The shell calls this only for `mode === 'default'` submissions —
   * passwords and editor lines are not echoed (passwords for obvious
   * reasons; editor lines because the server echoes them itself).
   */
  public writeLocalEcho(line: string): void {
    if (!this.terminal) return;
    this.terminal.write(`${line}\r\n`);
    this.screenReader?.appendToHistory(`${line}\n`);
  }

  /**
   * Current terminal viewport size in cells. The shell uses this to
   * report initial dimensions to the MUD via `mudService.connect`, so the
   * MUD wraps lines for the actual visible width instead of falling back
   * to the 80×24 default.
   */
  public getDimensions(): { columns: number; rows: number } {
    if (!this.terminal) {
      return { columns: 80, rows: 24 };
    }
    return { columns: this.terminal.cols, rows: this.terminal.rows };
  }

  /**
   * Full output pipeline for one chunk: MXP-filter → triggers → terminal
   * write → screen-reader announce + history append. Mirrors
   * `MudClientComponent.transformMudOutput` minus the prompt-manager step
   * (we have no local xterm prompt to splice).
   */
  private transformAndWrite(data: string): void {
    const segments = this.mxpFilter.processToSegments(data);
    let announcement = '';

    for (const seg of segments) {
      if (seg.type === 'text') {
        const result = this.triggerEngine.processChunk(seg.content);
        this.terminal.write(result.text);
        announcement += result.text;
        for (const s of result.sounds) {
          this.triggerSoundPlayer.play(s.soundId, s.volume);
        }
      } else {
        // Clickable segments are written as plain text — see class doc.
        this.terminal.write(seg.content);
        announcement += seg.content;
      }
    }

    if (announcement.length > 0) {
      this.screenReader?.announce(announcement);
      this.screenReader?.appendToHistory(announcement);
    }
  }

  private handleGlobalKeydown(event: KeyboardEvent): void {
    // Ctrl+End / Cmd+End: jump to the current output and drain the
    // screen-reader queue. No Shift / Alt modifiers — those are reserved
    // for future shortcuts and would otherwise hijack the user's
    // text-selection extension chords.
    const isJumpShortcut =
      (event.ctrlKey || event.metaKey) &&
      !event.shiftKey &&
      !event.altKey &&
      event.key === 'End';

    if (isJumpShortcut) {
      this.outputJump.requestJump();
      event.preventDefault();
    }
  }

  private jumpToCurrentOutput(): void {
    this.terminal?.scrollToBottom();
    this.screenReader?.stopAnnouncements();
  }
}
