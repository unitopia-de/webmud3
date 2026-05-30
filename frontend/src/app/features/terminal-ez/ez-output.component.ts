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
import { pairwise } from 'rxjs/operators';

import { MudService } from '@webmud3/frontend/core/mud/services/mud.service';
import { DebugSettingsService } from '@webmud3/frontend/features/debug/debug-settings.service';
import { OutputHistoryService } from '@webmud3/frontend/shared/services/output-history.service';
import {
  ClickAction,
  MudScreenReaderAnnouncer,
  MxpChoiceMenuService,
  MxpClickableService,
  MxpElementService,
  MxpStreamFilter,
  MxpTagRouter,
  StreamSegment,
  TerminalThemeDefinition,
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
 * Output pipeline (feature parity with the classic shell):
 *   1. Server chunk arrives via `MudService.mudOutput$`.
 *   2. `MxpStreamFilter` splits the chunk into text / clickable segments
 *      and routes MXP tags to `MxpTagRouter` (entity / stat / element
 *      updates flow into the shared root-singleton services).
 *   3. For each text segment, `TriggerEngineService.processChunk` produces
 *      the ANSI-highlighted output text plus any sounds the user's triggers
 *      asked for; sounds go through `triggerSoundPlayer.play(...)`.
 *   4. Clickable segments (room exits, ircontent, send-href etc.) are
 *      written as OSC 8 hyperlinks; xterm's `linkHandler` dispatches
 *      clicks back to `handleMxpHyperlinkClick`, which resolves the id
 *      via `MxpClickableService`, optionally opens the choice menu when
 *      multiple commands are bound to the same href, and finally sends
 *      the selected command via `mudService.sendMessage`.
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
  private readonly outputHistory = inject(OutputHistoryService);
  private readonly mxpRouter = inject(MxpTagRouter);
  private readonly mxpClickables = inject(MxpClickableService);
  private readonly mxpElements = inject(MxpElementService);
  private readonly mxpChoiceMenu = inject(MxpChoiceMenuService);
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

  // Snapshot of the current LINEMODE-edit bit. Updated from `linemode$`
  // below; used by `sendClickCommand` to decide whether a trailing `\r`
  // is required when the server has switched the session to char-mode.
  private isEditMode = true;

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
      // OSC 8 hyperlink click routing. `allowNonHttpProtocols: true` is
      // required because our scheme is `mxp:` — without it xterm silently
      // blocks the click for security.
      linkHandler: {
        allowNonHttpProtocols: true,
        activate: (event, text) => {
          this.handleMxpHyperlinkClick(text, event);
        },
      },
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

    // Live theme updates: the initial theme above is only a snapshot. When
    // the user picks a different colour scheme via the footer menu, the
    // TerminalThemeService emits on theme$ — we apply both `theme` and
    // `minimumContrastRatio` to the live xterm options. Without this the
    // EZ terminal kept whatever theme was active at mount time, and a
    // half-applied switch (background updated, foreground not) happened
    // because only one of the two options was ever set.
    this.subscriptions.add(
      this.terminalThemes.theme$.subscribe((def) => this.applyTheme(def)),
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

    // Visible + audible notice on real disconnects only (true → false).
    // pairwise() suppresses the initial `false` emission from the
    // BehaviorSubject before the first connection has been established.
    // Without this an EZ shell opened before the socket connected would
    // immediately announce "Verbindung getrennt", which is wrong.
    this.subscriptions.add(
      this.mudService.connectedToMud$
        .pipe(pairwise())
        .subscribe(([prev, next]) => {
          if (prev && !next) {
            this.writeLocalNotice('[Verbindung getrennt]');
          }
        }),
    );

    // Track the linemode edit-bit so `sendClickCommand` can decide whether
    // it has to ship its own `\r` (server in char-mode swallows the auto-
    // Enter that the backend normally appends).
    this.subscriptions.add(
      this.mudService.linemode$.subscribe((state) => {
        this.isEditMode = state.edit;
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

    // Re-inject any persisted backlog (e.g. the user navigated here from
    // `/` after a long Classic session). Must run AFTER subscribing to
    // mudOutput$ so that any chunk that arrives while we're walking the
    // localStorage entries still lands in the terminal — but BEFORE the
    // user can type, so the prompt the MUD sends after the existing
    // backlog appears on a fresh line.
    this.loadHistoryIfAvailable();
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
   * Re-injects the persisted MUD-output backlog into a freshly mounted
   * EZ terminal. Used when the user navigated here from `/` and the
   * Classic shell tore down its terminal — the SocketsService persists
   * every chunk into `OutputHistoryService` regardless of which shell
   * is active, so we always have something to restore.
   *
   * Important details (kept in sync with
   * `MudClientComponent.loadHistoryIfAvailable`):
   *
   *  - Uses a **fresh** `MxpStreamFilter` with NO tag callback so MXP
   *    tag side-effects (entity / stat / element registration, click
   *    region IDs) don't fire a second time. The live filter already
   *    populated those singletons during the original session.
   *  - Writes only via `terminal.write` — no `screenReader.announce`,
   *    no `appendToHistory`. The restored content is visible in xterm
   *    but is NOT replayed audibly: AT users would otherwise be flooded
   *    with hours of old output every time they switch shells.
   *  - Clickable segments are written as plain text (no OSC 8 wrapping).
   *    Scrollback exits should not be clickable: a click on a stale
   *    exit in the old buffer could move the player out of the current
   *    room.
   */
  private loadHistoryIfAvailable(): void {
    const entries = this.outputHistory.loadEntries();
    if (entries.length === 0) {
      return;
    }

    const restoreFilter = new MxpStreamFilter();

    for (const entry of entries) {
      if (entry.type === 'input') {
        this.terminal.write(entry.data);
        continue;
      }
      const segments = restoreFilter.processToSegments(entry.data);
      for (const seg of segments) {
        this.terminal.write(seg.content);
      }
    }
  }

  /**
   * Writes a local notice (e.g. "[Verbindung getrennt]") in bold cyan into
   * the terminal AND announces it through the screen reader / history.
   * No prompt-manager wrap is needed here — EZ has no local xterm prompt
   * to splice around the notice.
   */
  private writeLocalNotice(text: string): void {
    if (!this.terminal) return;
    // ESC[1;36m = bold cyan, ESC[0m = reset. Same colour MudClient uses
    // so users get the same visual cue regardless of which shell they're
    // looking at.
    this.terminal.write(`\x1b[1;36m${text}\x1b[0m\r\n`);
    this.screenReader?.announce(text);
    this.screenReader?.appendToHistory(text);
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
   * write (text + clickable OSC 8) → screen-reader announce + history
   * append. Mirrors `MudClientComponent.transformMudOutput` minus the
   * prompt-manager step (we have no local xterm prompt to splice).
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
        this.writeClickableSegment(seg);
        // The clickable text itself (without the MXP wrapper) belongs in
        // the audible stream so the screen reader keeps the verbatim
        // transcript.
        announcement += seg.content;
      }
    }

    if (announcement.length > 0) {
      this.screenReader?.announce(announcement);
      this.screenReader?.appendToHistory(announcement);
    }
  }

  /**
   * Writes a clickable segment as an OSC 8 hyperlink wrapped in ANSI
   * underline codes. xterm tracks the link position natively as the
   * buffer scrolls; clicks land in `handleMxpHyperlinkClick` via the
   * `linkHandler` configured in `ngAfterViewInit`.
   *
   * If the segment cannot be resolved to an action (no <!ELEMENT>
   * definition, missing `href` on a `<send>`, …) we still write the
   * content as plain text so nothing gets dropped from the visible
   * stream.
   */
  private writeClickableSegment(
    seg: Extract<StreamSegment, { type: 'clickable' }>,
  ): void {
    if (seg.content.length === 0) {
      return;
    }

    const action = this.deriveClickAction(seg);
    if (action === null) {
      this.terminal.write(seg.content);
      return;
    }

    const id = this.mxpClickables.register(
      action.action,
      action.label,
      action.expireDomain,
    );

    const url = `mxp:click/${id}`;
    // OSC 8 hyperlinks: open + content + close. ST = `ESC \` (string
    // terminator). The content is rendered in bright blue (`94`) with an
    // underline (`4`) so clickable exits / room objects stand out from
    // plain output — `24;39` then turns the underline off and resets the
    // foreground to the theme default so following text is unaffected.
    this.terminal.write(
      `\x1b]8;;${url}\x1b\\\x1b[94;4m${seg.content}\x1b[24;39m\x1b]8;;\x1b\\`,
    );
  }

  /**
   * Called by the terminal's `linkHandler` when the user clicks an OSC 8
   * hyperlink in the buffer. Resolves the id via `MxpClickableService`;
   * silently swallows clicks on regions that have been expired by a
   * domain switch (e.g. an old room's exit after a successful move).
   */
  private handleMxpHyperlinkClick(url: string, event: MouseEvent): void {
    const prefix = 'mxp:click/';
    if (!url.startsWith(prefix)) {
      return;
    }
    const id = Number(url.slice(prefix.length));
    if (!Number.isFinite(id)) {
      return;
    }
    const region = this.mxpClickables.lookup(id);
    if (region === null) {
      return;
    }
    this.activateClickRegion(region.action, event);
  }

  /**
   * Computes what should happen when the user clicks the given clickable
   * segment. Returns `null` for segments we cannot resolve (e.g. an
   * `ircontent` whose `<!ELEMENT>` definition the server never sent).
   *
   * Logic mirrors `MudClientComponent.deriveClickAction` — keep them in
   * sync if you touch one.
   */
  private deriveClickAction(
    seg: Extract<StreamSegment, { type: 'clickable' }>,
  ): {
    action: ClickAction;
    label: string;
    expireDomain?: string;
  } | null {
    if (seg.tag === 'rexit') {
      const command = seg.content.trim();
      if (command.length === 0) return null;
      return {
        action: { kind: 'simple', command },
        label: command,
        expireDomain: 'room',
      };
    }

    if (seg.tag === 'enzyfun') {
      const target = seg.content.trim();
      if (target.length === 0) return null;
      return {
        action: { kind: 'simple', command: `? ${target}` },
        label: target,
      };
    }

    if (seg.tag === 'enzybsp') {
      const target = seg.content.trim();
      if (target.length === 0) return null;
      return {
        action: { kind: 'simple', command: `bsp? ${target}` },
        label: target,
      };
    }

    if (seg.tag === 'send') {
      const href = seg.attrs.get('href');
      if (href === undefined) return null;
      return this.actionFromHref(href, seg.attrs.get('expire'));
    }

    // ircontent / lrcontent / iinventory — resolve via the ELEMENT table.
    const resolved = this.mxpElements.resolve(seg.tag, seg.attrs);
    if (resolved === null) return null;
    return this.actionFromHref(resolved.href, resolved.expire);
  }

  private actionFromHref(
    href: string,
    expire: string | undefined,
  ): {
    action: ClickAction;
    label: string;
    expireDomain?: string;
  } {
    const commands = href
      .split('|')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    if (commands.length === 0) {
      return {
        action: { kind: 'simple', command: '' },
        label: '',
        expireDomain: expire,
      };
    }
    if (commands.length === 1) {
      return {
        action: { kind: 'simple', command: commands[0] },
        label: commands[0],
        expireDomain: expire,
      };
    }
    return {
      action: { kind: 'choice', commands },
      label: commands.join(' | '),
      expireDomain: expire,
    };
  }

  private activateClickRegion(action: ClickAction, event: MouseEvent): void {
    if (action.kind === 'simple') {
      if (!action.command) return;
      this.sendClickCommand(action.command);
      return;
    }

    if (action.commands.length === 0) {
      return;
    }

    this.mxpChoiceMenu.open({
      commands: action.commands,
      x: event.clientX,
      y: event.clientY,
      onPick: (command) => this.sendClickCommand(command),
    });
  }

  /**
   * Sends a full command line generated by a click. In normal line-edit
   * mode the backend appends `\r` itself; in char-mode (e.g. UNItopia's
   * `vt100client`) the auto-Enter is suppressed and the click has to
   * ship its own terminator, otherwise the command sits in the input
   * buffer waiting for an Enter that will never come.
   */
  private sendClickCommand(command: string): void {
    const payload = this.isEditMode ? command : `${command}\r`;
    this.mudService.sendMessage(payload);
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

  /**
   * Applies a theme definition to the live xterm instance. Both `theme`
   * and `minimumContrastRatio` are part of `Terminal.options`, so the
   * change takes effect immediately without re-creating the terminal.
   * Mirrors `MudClientComponent.applyTerminalTheme` — keep them in sync.
   */
  private applyTheme(def: TerminalThemeDefinition): void {
    if (!this.terminal) return;
    this.terminal.options.theme = def.theme;
    this.terminal.options.minimumContrastRatio = def.minimumContrastRatio;
  }
}
