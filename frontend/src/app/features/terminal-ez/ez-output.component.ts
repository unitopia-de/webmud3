import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FitAddon } from '@xterm/addon-fit';
import { ISearchOptions, SearchAddon } from '@xterm/addon-search';
import { IDisposable, Terminal } from '@xterm/xterm';
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
  SelectionModeService,
  StreamSegment,
  TerminalThemeDefinition,
  TerminalThemeService,
} from '@webmud3/frontend/features/terminal';
import { OutputJumpService } from '@webmud3/frontend/features/terminal/output-jump.service';
import { namespacedStorage } from '@webmud3/frontend/shared/utils/storage-namespace';
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
  // Public so the template can read the active state + marker positions for
  // the touch-friendly two-tap-then-drag range selection. The footer button
  // (shared CharFooterComponent) arms the mode via this same root-singleton.
  public readonly selectionMode = inject(SelectionModeService);

  @ViewChild('terminalRef', { static: true })
  private readonly terminalRef!: ElementRef<HTMLDivElement>;

  @ViewChild('tailTerminalRef', { static: true })
  private readonly tailTerminalRef!: ElementRef<HTMLDivElement>;

  @ViewChild('splitRef', { static: true })
  private readonly splitRef!: ElementRef<HTMLDivElement>;

  @ViewChild('searchInputRef')
  private readonly searchInputRef?: ElementRef<HTMLInputElement>;

  @ViewChild('liveRegionRef', { static: true })
  private readonly liveRegionRef!: ElementRef<HTMLDivElement>;

  @ViewChild('historyRegionRef', { static: true })
  private readonly historyRegionRef!: ElementRef<HTMLElement>;

  @ViewChild('startupRegionRef', { static: true })
  private readonly startupRegionRef!: ElementRef<HTMLDivElement>;

  private terminal!: Terminal;
  private readonly fitAddon = new FitAddon();
  private screenReader?: MudScreenReaderAnnouncer;

  // --- Full-text search (Idee 3, /ez only) -----------------------------------
  // Searches the MAIN terminal's scrollback buffer via the xterm SearchAddon.
  // Jumping to a match scrolls the main terminal up to it; thanks to the
  // live-tail (Idee 2) the newest output then stays visible in the bottom pane
  // while the match is shown above. Search is display-only and never touches
  // the MUD or the screen-reader transcript (only the result count is spoken).
  private readonly searchAddon = new SearchAddon();
  protected readonly searchOpen = signal(false);
  protected readonly searchCaseSensitive = signal(false);
  protected readonly searchRegex = signal(false);
  // resultIndex is 0-based (-1 = no active match); resultCount is the total.
  protected readonly searchResult = signal<{ index: number; count: number }>({
    index: -1,
    count: 0,
  });
  /** Visible "3/12" style counter. */
  protected readonly searchCountLabel = computed(() => {
    const { index, count } = this.searchResult();
    if (count <= 0) return '0/0';
    return `${index + 1}/${count}`;
  });
  /** Verbose label for the screen reader (announced via aria-live). */
  protected readonly searchSrLabel = computed(() => {
    const { index, count } = this.searchResult();
    if (count <= 0) return 'Keine Treffer';
    return `Treffer ${index + 1} von ${count}`;
  });

  // --- Live-tail (Idee 2) ----------------------------------------------------
  // A second, display-only xterm stacked below the main one. It mirrors the
  // same output stream and always stays scrolled to the bottom, so the newest
  // output remains visible while the user scrolls the MAIN terminal back
  // through history. It owns no input, sends no NAWS (only the main terminal
  // reports dimensions) and is never announced to screen readers — it's a pure
  // visual mirror.
  private tailTerminal!: Terminal;
  private readonly tailFitAddon = new FitAddon();
  /** True while the main terminal is scrolled up off the bottom. */
  protected readonly tailVisible = signal(false);
  /** Height share of the tail pane (0..1), drag-adjustable and persisted. */
  protected readonly tailFraction = signal(0.34);
  private readonly TAIL_FRACTION_STORAGE = 'webmud3-ez-tail-fraction';
  private readonly TAIL_MIN = 0.15;
  private readonly TAIL_MAX = 0.6;
  // Coalesces multiple refit requests (rapid scroll / splitter drag) into one
  // fit per animation frame.
  private pendingRefit = false;

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

  // One-time startup announcement. iOS VoiceOver reads the FIRST polite
  // update at page load unreliably (region not yet registered as "live",
  // and/or VO is busy reading the auto-focused input's label). A fixed
  // short delay turned out to be pure luck and also clipped the burst: the
  // post-login "du warst zuletzt …" block + the initial room description
  // arrive over several chunks and ran past a fixed window. So instead we
  // BUFFER the whole burst and flush it ONCE — when the output goes quiet
  // (debounce = the server finished the block incl. prompt and is waiting
  // for input), or at the latest after a hard cap. The flush goes through
  // the assertive startup region (`#startupRegionRef`) — the exact mechanism
  // (assertive + role=status + replace) that announces reliably for the
  // EzInput mode-announcer. After the flush everything is immediate + polite
  // (classic). Re-armed on the login transition (see showEcho$).
  private srPrimed = false;
  private srPrimeBuffer = '';
  // Fires once output has been quiet for long enough → the burst is complete,
  // flush it. Reset on every buffered chunk so a multi-chunk burst keeps
  // accumulating until the server actually pauses. The delay depends on the
  // phase (see scheduleStartupSettle):
  //  - Page-load (mount): prompt-aware. The welcome banner ends with the name
  //    prompt and the server then waits for the user to type their name, so a
  //    prompt = "done" → flush quickly (SR_SETTLE_PROMPT_MS); a complete line
  //    means more may follow → wait a bit (SR_SETTLE_LINE_MS).
  //  - Login: a UNIFORM, generous quiet window that ignores prompts. Here the
  //    server sends the block in several parts separated by intermediate
  //    prompts WITHOUT waiting for input ("du warst zuletzt …" → room →
  //    prompt → "erwartete Spieler …" → prompt), so a prompt is NOT a "done"
  //    marker. We only flush once it is genuinely quiet, so the entire login
  //    block lands in one announcement and nothing arrives afterwards to
  //    overtake VoiceOver mid-read (observed: the "klatsche" line overtook a
  //    too-early flush).
  private srSettleTimer?: number;
  private readonly SR_SETTLE_PROMPT_MS = 500;
  private readonly SR_SETTLE_LINE_MS = 1800;
  private readonly SR_SETTLE_LOGIN_MS = 2500;
  // Hard cap: if the server never pauses (continuous stream), flush anyway
  // and fall back to the polite path so we don't buffer forever.
  private srMaxTimer?: number;
  private readonly SR_MAX_MS = 10000;
  // Which region the buffered burst is flushed through.
  //  - Page-load (pre-login banner): assertive `#startupRegionRef`. At mount
  //    there is no competing focus change, and the polite region is swallowed
  //    by VoiceOver before it is registered as live — assertive wins.
  //  - Login transition: POLITE (classic append). Right after the password is
  //    submitted the input `@switch` swaps the password <input> for the
  //    default <textarea>; focus moves and VoiceOver reads the new field's
  //    label, which preempts an assertive announcement (observed: the
  //    post-login "du warst zuletzt …" block + room were lost, while the
  //    later polite "erwartete Spieler …" line was heard). Buffering until the
  //    burst settles already defers the flush past that focus change, so a
  //    polite append is heard reliably — same channel that works in normal
  //    play.
  private srFlushAssertive = true;

  // --- Touch range-selection (two-tap-then-drag) -----------------------------
  // Ported 1:1 from MudClientComponent so `/ez` has the same tablet-friendly
  // selection UX. Classic stays untouched, so the logic is duplicated here on
  // purpose rather than refactored into a shared helper.
  private selectionTapHandler?: (event: PointerEvent) => void;
  private viewportScrollElement?: HTMLElement;
  private viewportScrollHandler?: () => void;
  private readonly terminalDisposables: IDisposable[] = [];

  // Bumped on every event that can move the on-screen marker positions
  // (scroll, resize). The marker-position computeds read it so they
  // re-evaluate without wiring every event into the signal graph by hand.
  private readonly markerInvalidator = signal(0);

  /**
   * Pixel coordinates (relative to the terminal container) for the start
   * marker, or `null` when inactive / scrolled out of the viewport.
   */
  public readonly xtermStartMarkerPos = computed<{
    x: number;
    y: number;
  } | null>(() => {
    this.markerInvalidator();
    const anchor = this.selectionMode.anchor();
    if (anchor === null || anchor.target !== 'xterm') return null;
    return this.xtermBufferPosToPixel(
      anchor.data as { col: number; row: number },
    );
  });

  /** Same as `xtermStartMarkerPos` for the end marker. */
  public readonly xtermEndMarkerPos = computed<{
    x: number;
    y: number;
  } | null>(() => {
    this.markerInvalidator();
    const end = this.selectionMode.end();
    if (end === null || end.target !== 'xterm') return null;
    return this.xtermBufferPosToPixel(
      end.data as { col: number; row: number },
    );
  });

  ngAfterViewInit(): void {
    const initialTheme = this.terminalThemes.theme;

    this.terminal = new Terminal({
      fontFamily: 'JetBrainsMono, monospace',
      disableStdin: true,
      screenReaderMode: false,
      // Required for the SearchAddon's match highlighting: it uses
      // terminal.registerDecoration(), which is gated behind allowProposedApi.
      // Without this the decoration call throws and the search silently does
      // nothing.
      allowProposedApi: true,
      // Larger scrollback so the full-text search (Idee 3) has more history
      // to work with — the SearchAddon can only find what's still in buffer.
      scrollback: 5000,
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
    this.terminal.loadAddon(this.searchAddon);
    // Keep the visible match counter / SR label in sync with the addon.
    this.terminalDisposables.push(
      this.searchAddon.onDidChangeResults(({ resultIndex, resultCount }) => {
        this.searchResult.set({ index: resultIndex, count: resultCount });
      }),
    );

    try {
      this.fitAddon.fit();
    } catch {
      // Initial fit can throw if the host is hidden — re-fits happen on resize.
    }

    // Live-tail terminal (Idee 2). Same look as the main terminal but with no
    // input, no link handler (clickable exits are written as plain text here so
    // OSC 8 IDs aren't registered twice) and a bounded scrollback — it only
    // ever needs to show the newest lines. Opened into a zero-height container;
    // it's fitted the moment it becomes visible (see refitPanes).
    this.tailTerminal = new Terminal({
      fontFamily: 'JetBrainsMono, monospace',
      disableStdin: true,
      screenReaderMode: false,
      scrollback: 500,
      theme: initialTheme.theme,
      minimumContrastRatio: initialTheme.minimumContrastRatio,
    });
    this.tailTerminal.open(this.tailTerminalRef.nativeElement);
    this.tailTerminal.loadAddon(this.tailFitAddon);

    // Restore the persisted tail height share, if any.
    const savedFraction = namespacedStorage.get(this.TAIL_FRACTION_STORAGE);
    if (savedFraction !== null) {
      const f = Number(savedFraction);
      if (Number.isFinite(f)) {
        this.tailFraction.set(this.clampFraction(f));
      }
    }

    // Touch range-selection: capture-phase tap handler + invalidate the
    // marker overlay positions whenever the buffer scrolls / resizes.
    this.setupSelectionTapHandler(this.terminalRef.nativeElement);

    this.viewportScrollElement =
      this.terminalRef.nativeElement.querySelector<HTMLElement>(
        '.xterm-viewport',
      ) ?? undefined;
    if (this.viewportScrollElement) {
      this.viewportScrollHandler = () => {
        this.markerInvalidator.update((n) => n + 1);
        this.updateTailVisibility();
      };
      this.viewportScrollElement.addEventListener(
        'scroll',
        this.viewportScrollHandler,
        { passive: true },
      );
    }

    this.terminalDisposables.push(
      this.terminal.onScroll(() => {
        this.markerInvalidator.update((n) => n + 1);
        this.updateTailVisibility();
      }),
      this.terminal.onResize(() =>
        this.markerInvalidator.update((n) => n + 1),
      ),
    );

    // Identical configuration to the classic shell — append strategy, no
    // separate input region (the native <textarea>/<input> is read by the OS
    // screen reader directly). No EZ-specific divergence.
    this.screenReader = new MudScreenReaderAnnouncer(
      this.liveRegionRef.nativeElement,
      this.historyRegionRef.nativeElement,
      () => this.debugSettings.screenReaderLogging,
    );

    // Start the one-time startup window (see field comment). When it
    // elapses, force the buffered startup text through the assertive startup
    // region, then switch to immediate polite announcements (classic). The
    // same window is re-armed on the login transition (see showEcho$ below).
    this.rearmStartupPriming(true);

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

    // Reset the MXP filter on (re)connect so a stale partial tag from a
    // previous session doesn't linger across a reconnect and confuse the
    // next chunk.
    //
    // We deliberately do NOT call `screenReader.markSessionStart()` here.
    // markSessionStart drains the announcement queue (stopAnnouncements)
    // and wipes the history region — and the MUD's pre-login welcome
    // banner arrives interleaved with the `mudConnect$` event, so calling
    // it would cut off / clear the banner announcement before VoiceOver
    // reads it (observed on iPad). MudClient never calls markSessionStart
    // either and announces the banner fine. The session-gating it provides
    // is moot here anyway: `announce()` is always invoked with the default
    // `Date.now()` timestamp, and the restored backlog goes through
    // `terminal.write` without `announce` (see loadHistoryIfAvailable), so
    // old output is never spoken regardless.
    this.subscriptions.add(
      this.mudService.mudConnect$.subscribe(() => {
        this.mxpFilter.reset();
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

    // Note: the post-login block is buffered via primeForLogin(), which the
    // shell calls on password submit — NOT via a TELNET ECHO edge. On at least
    // one MUD the server sends the whole "du warst zuletzt eingeloggt …" block
    // + room BEFORE re-enabling echo, so an echo-edge trigger fires too late
    // and misses it; an unguarded one could also re-arm during normal play and
    // make VoiceOver interrupt gameplay. The user's password submit is the
    // reliable early signal.

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
      // Re-fit both panes (tail only when visible) and recompute the marker
      // overlays — a resize moves every cell.
      this.refitPanes();
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
    if (this.selectionTapHandler && this.terminalRef?.nativeElement) {
      this.terminalRef.nativeElement.removeEventListener(
        'pointerdown',
        this.selectionTapHandler,
        { capture: true },
      );
    }
    if (this.viewportScrollElement && this.viewportScrollHandler) {
      this.viewportScrollElement.removeEventListener(
        'scroll',
        this.viewportScrollHandler,
      );
    }
    for (const d of this.terminalDisposables) {
      d.dispose();
    }
    this.clearStartupTimers();
    this.searchAddon.dispose();
    this.screenReader?.dispose();
    this.terminal?.dispose();
    this.tailTerminal?.dispose();
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
  /**
   * Starts the assertive-startup buffering for the post-login block. Called by
   * the shell the moment the user submits their password — i.e. BEFORE the
   * server's response arrives. This is deliberately not driven by the TELNET
   * ECHO edge: on at least one MUD the server sends the whole "du warst zuletzt
   * eingeloggt …" block + room description FIRST and only re-enables echo
   * afterwards, so an echo-edge trigger fires too late and misses the block.
   * Triggering on the user's own password submit captures everything from the
   * login attempt onward. Flushes polite (see srFlushAssertive) once the burst
   * settles, so the whole login output lands in one uninterrupted announcement.
   */
  public primeForLogin(): void {
    this.rearmStartupPriming(false);
  }

  public writeLocalEcho(line: string): void {
    if (!this.terminal) return;
    this.terminal.write(`${line}\r\n`);
    this.writeTail(`${line}\r\n`);
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
        this.writeTail(entry.data);
        continue;
      }
      const segments = restoreFilter.processToSegments(entry.data);
      for (const seg of segments) {
        this.terminal.write(seg.content);
        this.writeTail(seg.content);
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
    this.writeTail(`\x1b[1;36m${text}\x1b[0m\r\n`);
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
        this.writeTail(result.text);
        announcement += result.text;
        for (const s of result.sounds) {
          this.triggerSoundPlayer.play(s.soundId, s.volume);
        }
      } else {
        this.writeClickableSegment(seg);
        // Tail mirror gets the bare text (no OSC 8 wrapping): the tail is a
        // display-only mirror, clicks happen in the main terminal.
        this.writeTail(seg.content);
        // The clickable text itself (without the MXP wrapper) belongs in
        // the audible stream so the screen reader keeps the verbatim
        // transcript.
        announcement += seg.content;
      }
    }

    if (announcement.length > 0) {
      // Live announcement: immediate once primed (classic behaviour), or
      // buffered during the startup window so iOS VoiceOver doesn't swallow
      // the first burst (pre-login banner, and the post-login block + room).
      // Each buffered chunk pushes back the settle timer so the whole burst
      // is collected until the server pauses (prompt shown).
      if (this.srPrimed) {
        this.screenReader?.announce(announcement);
      } else {
        this.srPrimeBuffer += announcement;
        this.scheduleStartupSettle();
      }
      // History is always filled per-chunk (line-by-line H-navigation).
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
      return;
    }

    // Ctrl+F / Cmd+F: open (and focus) the in-terminal full-text search,
    // overriding the browser's own find bar. Esc closes it (handled in the
    // search input's keydown).
    const isSearchShortcut =
      (event.ctrlKey || event.metaKey) &&
      !event.shiftKey &&
      !event.altKey &&
      (event.key === 'f' || event.key === 'F');

    if (isSearchShortcut) {
      event.preventDefault();
      this.openSearch();
      return;
    }

    // Ctrl+C / Cmd+C: copy the current xterm range selection (placed via the
    // two-tap-then-drag flow). xterm in EZ has disableStdin + no focus, so
    // its own copy path never runs — we read the selection and write it to
    // the clipboard ourselves. We must NOT hijack the shortcut when the user
    // is copying text they selected inside the native input/textarea, so we
    // bail out if the focused editable has its own active selection.
    const isCopyShortcut =
      (event.ctrlKey || event.metaKey) &&
      !event.shiftKey &&
      !event.altKey &&
      (event.key === 'c' || event.key === 'C');

    if (isCopyShortcut && this.terminal?.hasSelection()) {
      const active = document.activeElement;
      const editableHasOwnSelection =
        (active instanceof HTMLTextAreaElement ||
          active instanceof HTMLInputElement) &&
        active.selectionStart !== active.selectionEnd;

      if (!editableHasOwnSelection) {
        const selection = this.terminal.getSelection();
        if (selection) {
          void navigator.clipboard.writeText(selection).catch((err) => {
            console.warn('[EzOutput] Clipboard write failed:', err);
          });
          event.preventDefault();
        }
      }
    }
  }

  private jumpToCurrentOutput(): void {
    this.terminal?.scrollToBottom();
    this.screenReader?.stopAnnouncements();
  }

  // ---------------------------------------------------------------------------
  // Live-tail (Idee 2)
  // ---------------------------------------------------------------------------

  /**
   * Mirrors a chunk into the live-tail terminal and keeps it pinned to the
   * bottom. No-op until the tail terminal exists. The tail always shows the
   * newest output regardless of where the main terminal is scrolled.
   */
  private writeTail(text: string): void {
    if (!this.tailTerminal) return;
    this.tailTerminal.write(text);
    this.tailTerminal.scrollToBottom();
  }

  /**
   * Shows the tail pane while the main terminal is scrolled UP off the
   * bottom and hides it once the user is back at the latest output. Driven
   * by the main terminal's scroll events. When visibility flips, both panes
   * are re-fitted because the main terminal's height changed.
   */
  private updateTailVisibility(): void {
    if (!this.terminal) return;
    const buf = this.terminal.buffer.active;
    // viewportY === baseY means the viewport top is at the bottom-most
    // scroll position, i.e. the newest output is on screen.
    const atBottom = buf.viewportY >= buf.baseY;
    const next = !atBottom;
    if (this.tailVisible() === next) return;
    this.tailVisible.set(next);
    this.refitPanes();
  }

  /**
   * Re-fits both terminals on the next frame. The DOM height changes when the
   * tail pane appears/disappears (or is resized in Phase 2); xterm needs an
   * explicit fit to match. Only the MAIN terminal would report dimensions to
   * the MUD — and `/ez` never sends NAWS on a local fit — so re-fitting here
   * is purely visual and safe.
   */
  private refitPanes(): void {
    if (this.pendingRefit) return;
    this.pendingRefit = true;
    requestAnimationFrame(() => {
      this.pendingRefit = false;
      try {
        this.fitAddon.fit();
      } catch {
        // Host hidden / zero-size — ignore, a later resize re-fits.
      }
      if (this.tailVisible()) {
        try {
          this.tailFitAddon.fit();
        } catch {
          // ignore — see above
        }
        this.tailTerminal?.scrollToBottom();
      }
      this.markerInvalidator.update((n) => n + 1);
    });
  }

  /**
   * Splitter drag: adjusts the tail's height share. Captures the pointer to
   * the handle so the drag survives the finger/cursor sliding off, mirrors
   * every move into `tailFraction` (clamped) and re-fits the panes. The chosen
   * fraction is persisted on release.
   */
  public onSplitterPointerDown(event: PointerEvent): void {
    event.preventDefault();
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);

    const onMove = (e: PointerEvent) => {
      const rect = this.splitRef.nativeElement.getBoundingClientRect();
      if (rect.height === 0) return;
      // The tail fills the area below the pointer, so its share is the
      // distance from the pointer to the bottom of the split container.
      const fromBottom = rect.bottom - e.clientY;
      this.tailFraction.set(this.clampFraction(fromBottom / rect.height));
      this.refitPanes();
    };
    const onUp = (e: PointerEvent) => {
      handle.releasePointerCapture(e.pointerId);
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      this.persistTailFraction();
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  }

  private clampFraction(f: number): number {
    return Math.min(this.TAIL_MAX, Math.max(this.TAIL_MIN, f));
  }

  private persistTailFraction(): void {
    namespacedStorage.set(
      this.TAIL_FRACTION_STORAGE,
      String(this.tailFraction()),
    );
  }

  // ---------------------------------------------------------------------------
  // Full-text search (Idee 3)
  // ---------------------------------------------------------------------------

  /** Builds the SearchAddon options from the current toggle signals. */
  private searchOptions(incremental: boolean): ISearchOptions {
    return {
      regex: this.searchRegex(),
      caseSensitive: this.searchCaseSensitive(),
      incremental,
      decorations: {
        matchBackground: '#766c00',
        matchBorder: '#aa9b00',
        matchOverviewRuler: '#766c00',
        activeMatchBackground: '#d18616',
        activeMatchBorder: '#ffae57',
        activeMatchColorOverviewRuler: '#d18616',
      },
    };
  }

  /** Current search term from the input field (empty when closed). */
  private get searchTerm(): string {
    return this.searchInputRef?.nativeElement.value ?? '';
  }

  /** Opens the search bar and moves focus into its input. */
  public openSearch(): void {
    this.searchOpen.set(true);
    // setTimeout (macrotask) so Angular's change detection renders the @if
    // input before we focus it — a microtask could run before the DOM update.
    setTimeout(() => {
      const input = this.searchInputRef?.nativeElement;
      if (!input) return;
      input.focus();
      input.select();
      if (input.value) {
        this.runSearch(true);
      }
    });
  }

  /** Closes the search bar and clears all match highlighting. */
  public closeSearch(): void {
    this.searchOpen.set(false);
    this.searchAddon.clearDecorations();
    this.searchResult.set({ index: -1, count: 0 });
  }

  /** (input) handler: incremental search as the user types. */
  protected onSearchInput(): void {
    this.runSearch(true);
  }

  protected onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.shiftKey) {
        this.findPrevious();
      } else {
        this.findNext();
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeSearch();
    }
  }

  public findNext(): void {
    const term = this.searchTerm;
    if (!term) {
      this.closeSearchHighlights();
      return;
    }
    this.searchAddon.findNext(term, this.searchOptions(false));
  }

  public findPrevious(): void {
    const term = this.searchTerm;
    if (!term) {
      this.closeSearchHighlights();
      return;
    }
    this.searchAddon.findPrevious(term, this.searchOptions(false));
  }

  protected toggleSearchCase(): void {
    this.searchCaseSensitive.update((v) => !v);
    this.runSearch(true);
  }

  protected toggleSearchRegex(): void {
    this.searchRegex.update((v) => !v);
    this.runSearch(true);
  }

  /**
   * Runs an (incremental) search for the current term, or clears the
   * highlighting when the term is empty.
   */
  private runSearch(incremental: boolean): void {
    const term = this.searchTerm;
    if (!term) {
      this.closeSearchHighlights();
      return;
    }
    this.searchAddon.findNext(term, this.searchOptions(incremental));
  }

  /** Clears decorations + counter without closing the bar. */
  private closeSearchHighlights(): void {
    this.searchAddon.clearDecorations();
    this.searchResult.set({ index: -1, count: 0 });
  }

  /**
   * Forces the one-time startup text through the assertive startup region
   * (`#startupRegionRef`). Uses the same clear → microtask → set two-step as
   * the EzInput mode-announcer, which the tester confirmed VoiceOver reads
   * reliably. ANSI is stripped via the announcer's normalizer. Assertive is
   * intentional here: it overrides VoiceOver still reading the input label
   * and pushes the welcome banner through. This is ONLY the startup flush;
   * normal output stays on the polite region.
   */
  /**
   * (Re-)opens the assertive startup buffering phase. Sets `srPrimed = false`,
   * drops any buffered text and arms the hard-cap timer. From here every
   * announcement is collected into `srPrimeBuffer` (see transformAndWrite);
   * the burst is flushed when output goes quiet (`scheduleStartupSettle`) or
   * at the latest after `SR_MAX_MS`. The flush forces the whole text through
   * the assertive `#startupRegionRef` once, then `srPrimed = true` returns to
   * the immediate polite (classic) path.
   *
   * Called twice: once at mount (page-load pre-login banner) and again on the
   * login transition (echo off → on, post-login block + initial room). Both
   * are focus/render transitions where iOS VoiceOver swallows a polite update,
   * so both need the forced assertive flush.
   */
  private rearmStartupPriming(assertive: boolean): void {
    this.clearStartupTimers();
    this.srPrimed = false;
    this.srPrimeBuffer = '';
    this.srFlushAssertive = assertive;
    this.srMaxTimer = window.setTimeout(
      () => this.flushStartupBuffer(),
      this.SR_MAX_MS,
    );
  }

  /**
   * (Re)schedules the settle timer. Called on every buffered chunk: as long as
   * output keeps arriving the flush is pushed back, so the entire burst is
   * collected. When the server pauses (prompt shown, waiting for input) the
   * timer finally fires and the buffer is flushed.
   */
  private scheduleStartupSettle(): void {
    if (this.srSettleTimer !== undefined) {
      window.clearTimeout(this.srSettleTimer);
    }
    let delay: number;
    if (this.srFlushAssertive) {
      // Page-load (welcome banner). Prompt-aware: a trailing prompt means the
      // server is waiting for the user's name → flush quickly; a complete line
      // means more may follow → wait a bit.
      const endsOnCompleteLine = /\n[^\S\r\n]*$/.test(this.srPrimeBuffer);
      delay = endsOnCompleteLine
        ? this.SR_SETTLE_LINE_MS
        : this.SR_SETTLE_PROMPT_MS;
    } else {
      // Login block. Intermediate prompts are NOT "done" markers here, so we
      // ignore them and wait for a genuine pause — the whole block (incl. the
      // "klatsche" tail after an intermediate prompt) must land in one flush.
      delay = this.SR_SETTLE_LOGIN_MS;
    }
    this.srSettleTimer = window.setTimeout(
      () => this.flushStartupBuffer(),
      delay,
    );
  }

  /**
   * Flushes the buffered startup burst through the assertive region once and
   * switches back to the immediate polite path. Idempotent: clears both timers
   * so a settle/cap race only flushes once.
   */
  private flushStartupBuffer(): void {
    this.clearStartupTimers();
    this.srPrimed = true;
    const buffered = this.srPrimeBuffer;
    this.srPrimeBuffer = '';
    if (!buffered) {
      return;
    }
    if (this.srFlushAssertive) {
      // Page-load banner: force through the assertive startup region.
      this.announceStartup(buffered);
    } else {
      // Login block: polite append (classic). The settle delay has already
      // carried us past the input @switch focus change, so VoiceOver reads
      // this just like normal play output.
      this.screenReader?.announce(buffered);
    }
  }

  private clearStartupTimers(): void {
    if (this.srSettleTimer !== undefined) {
      window.clearTimeout(this.srSettleTimer);
      this.srSettleTimer = undefined;
    }
    if (this.srMaxTimer !== undefined) {
      window.clearTimeout(this.srMaxTimer);
      this.srMaxTimer = undefined;
    }
  }

  private announceStartup(raw: string): void {
    const text = this.screenReader?.normalizeForComparison(raw) ?? raw;
    if (!text) return;
    const region = this.startupRegionRef.nativeElement;
    region.textContent = '';
    queueMicrotask(() => {
      region.textContent = text;
    });
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
    if (this.tailTerminal) {
      this.tailTerminal.options.theme = def.theme;
      this.tailTerminal.options.minimumContrastRatio =
        def.minimumContrastRatio;
    }
  }

  // ---------------------------------------------------------------------------
  // Touch range-selection (two-tap-then-drag)
  //
  // Ported from MudClientComponent (setupSelectionTapHandler,
  // pointerToXtermBufferPos, xtermBufferPosToPixel,
  // applyXtermSelectionFromMarkers, onXtermMarkerPointerDown). Keep in sync
  // with the classic implementation if you change the selection behaviour.
  // ---------------------------------------------------------------------------

  /**
   * Capture-phase pointer listener that drives the two-tap range selection.
   * State machine lives in SelectionModeService:
   *   - inactive        → no-op, xterm's own pointer handling runs.
   *   - awaiting-anchor  → first tap places the start marker.
   *   - awaiting-extend  → second tap places the end marker + renders the
   *                        initial selection, state becomes `adjusting`.
   *   - adjusting        → background taps ignored; the user refines by
   *                        dragging a handle (onXtermMarkerPointerDown).
   *
   * Capture phase so we beat xterm's internal pointer handler on the canvas.
   */
  private setupSelectionTapHandler(element: HTMLElement): void {
    this.selectionTapHandler = (event: PointerEvent) => {
      if (!this.selectionMode.isActive()) {
        return;
      }

      // Let the marker handles process their own pointer events.
      const target = event.target as HTMLElement | null;
      if (target?.closest('.selection-marker')) {
        return;
      }

      // In `adjusting` a stray background tap must not re-anchor or commit —
      // the user ends adjusting via the footer button.
      if (this.selectionMode.state() === 'adjusting') {
        return;
      }

      const pos = this.pointerToXtermBufferPos(event.clientX, event.clientY);
      if (pos === null) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const anchor = this.selectionMode.anchor();
      if (anchor === null || anchor.target !== 'xterm') {
        this.selectionMode.setAnchor('xterm', pos);
        return;
      }

      this.selectionMode.setEnd('xterm', pos);
      this.applyXtermSelectionFromMarkers();
      // Deliberately NO terminal.focus() here (unlike classic): EZ keeps the
      // keyboard focus in the native input field; stealing it to the
      // disabled xterm would prevent the user from typing.
    };

    element.addEventListener('pointerdown', this.selectionTapHandler, {
      capture: true,
    });
  }

  /**
   * Pixel coords (clientX/Y in viewport space) → buffer position
   * (`{col, row}`, absolute buffer row incl. scrollback). `null` when the
   * terminal hasn't rendered or the pointer is outside the cell grid.
   */
  private pointerToXtermBufferPos(
    clientX: number,
    clientY: number,
  ): { col: number; row: number } | null {
    const screen =
      this.terminalRef.nativeElement.querySelector<HTMLElement>(
        '.xterm-screen',
      );
    const rect = (screen ?? this.terminalRef.nativeElement).getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return null;
    }

    const cellWidth = rect.width / this.terminal.cols;
    const cellHeight = rect.height / this.terminal.rows;
    const col = Math.max(
      0,
      Math.min(
        this.terminal.cols - 1,
        Math.floor((clientX - rect.left) / cellWidth),
      ),
    );
    const viewportRow = Math.max(
      0,
      Math.min(
        this.terminal.rows - 1,
        Math.floor((clientY - rect.top) / cellHeight),
      ),
    );
    const bufferRow = this.terminal.buffer.active.viewportY + viewportRow;
    return { col, row: bufferRow };
  }

  /**
   * Buffer position → pixel coords relative to the terminal container, for
   * absolute-positioning a marker overlay. `null` when the buffer row is
   * scrolled off-screen (the marker hides in that case).
   */
  private xtermBufferPosToPixel(pos: {
    col: number;
    row: number;
  }): { x: number; y: number } | null {
    const screen =
      this.terminalRef.nativeElement.querySelector<HTMLElement>(
        '.xterm-screen',
      );
    if (!screen) return null;

    const screenRect = screen.getBoundingClientRect();
    const containerRect = this.terminalRef.nativeElement.getBoundingClientRect();
    if (screenRect.width === 0 || screenRect.height === 0) return null;

    const viewportRow = pos.row - this.terminal.buffer.active.viewportY;
    if (viewportRow < 0 || viewportRow >= this.terminal.rows) {
      return null;
    }

    const cellWidth = screenRect.width / this.terminal.cols;
    const cellHeight = screenRect.height / this.terminal.rows;

    const x =
      screenRect.left - containerRect.left + (pos.col + 0.5) * cellWidth;
    const y =
      screenRect.top - containerRect.top + (viewportRow + 0.5) * cellHeight;

    return { x, y };
  }

  /**
   * Reads the anchor/end signals and applies the range to xterm via
   * `Terminal.select(...)`. Called after the second tap and on every
   * pointermove during a drag.
   */
  private applyXtermSelectionFromMarkers(): void {
    const anchor = this.selectionMode.anchor();
    const end = this.selectionMode.end();
    if (
      anchor === null ||
      end === null ||
      anchor.target !== 'xterm' ||
      end.target !== 'xterm'
    ) {
      return;
    }

    const a = anchor.data as { col: number; row: number };
    const b = end.data as { col: number; row: number };

    let startCol = a.col;
    let startRow = a.row;
    let endCol = b.col;
    let endRow = b.row;
    if (startRow > endRow || (startRow === endRow && startCol > endCol)) {
      [startCol, startRow, endCol, endRow] = [endCol, endRow, startCol, startRow];
    }

    const length =
      (endRow - startRow) * this.terminal.cols + (endCol - startCol) + 1;
    this.terminal.select(startCol, startRow, length);
  }

  /**
   * Drag-start handler for a marker overlay. Captures the pointer to the
   * handle so we keep receiving moves even when the finger slides off, then
   * mirrors every movement into the selection-service signal and re-renders.
   */
  public onXtermMarkerPointerDown(
    event: PointerEvent,
    which: 'start' | 'end',
  ): void {
    event.preventDefault();
    event.stopPropagation();

    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);

    const onMove = (e: PointerEvent) => {
      const pos = this.pointerToXtermBufferPos(e.clientX, e.clientY);
      if (pos === null) return;
      if (which === 'start') {
        this.selectionMode.updateAnchor(pos);
      } else {
        this.selectionMode.updateEnd(pos);
      }
      this.applyXtermSelectionFromMarkers();
    };

    const onUp = () => {
      handle.releasePointerCapture(event.pointerId);
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  }
}
