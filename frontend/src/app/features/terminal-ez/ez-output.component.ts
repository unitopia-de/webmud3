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
  TerminalThemeService,
} from '@webmud3/frontend/features/terminal';

/**
 * Read-only xterm output panel for the EZ-Shell (`/ez`).
 *
 * The whole reason `/ez` exists is to dodge the Mac-Safari freezes caused by
 * the xterm helper-textarea. To make that dodge effective we open xterm with
 * `disableStdin: true` and never register an `onData` handler — the terminal
 * becomes a pure display surface. Input is handled by a separate native
 * `<textarea>` / `<input>` element introduced in Phase 3.
 *
 * Phase 2 deliberately ships a minimal output pipeline: server chunks go
 * straight into `terminal.write` and the screen reader announcer, without
 * MXP filtering, trigger evaluation or sound playback. The full pipeline
 * (MXP filter, triggers, sounds, prompt manager) is added in Phase 6 once
 * the basic display + input loop has been verified on Mac-Safari.
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

  @ViewChild('terminalRef', { static: true })
  private readonly terminalRef!: ElementRef<HTMLDivElement>;

  @ViewChild('liveRegionRef', { static: true })
  private readonly liveRegionRef!: ElementRef<HTMLDivElement>;

  @ViewChild('historyRegionRef', { static: true })
  private readonly historyRegionRef!: ElementRef<HTMLElement>;

  private terminal!: Terminal;
  private readonly fitAddon = new FitAddon();
  private screenReader?: MudScreenReaderAnnouncer;
  private subscriptions = new Subscription();
  private resizeListener?: () => void;

  ngAfterViewInit(): void {
    const initialTheme = this.terminalThemes.theme;

    // disableStdin + no onData handler → pure display surface, no helper
    // textarea key handling. screenReaderMode stays off because we drive the
    // ARIA-live region ourselves via MudScreenReaderAnnouncer.
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
        this.terminal.write(data);
        this.screenReader?.announce(data);
        this.screenReader?.appendToHistory(data);
      }),
    );

    // Reset the announcement session on (re)connect so backlog from a
    // previous connection is not replayed.
    this.subscriptions.add(
      this.mudService.mudConnect$.subscribe(() => {
        this.screenReader?.markSessionStart(Date.now());
      }),
    );

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
}
