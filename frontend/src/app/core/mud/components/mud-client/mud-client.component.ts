import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { AttachAddon } from '@xterm/addon-attach';
import { ClipboardAddon } from '@xterm/addon-clipboard';
import { FitAddon } from '@xterm/addon-fit';
import { IDisposable, Terminal } from '@xterm/xterm';
import { Subscription } from 'rxjs';

import { MudService } from '../../services/mud.service';
import { MudNoticeService } from '../../services/mud-notice.service';
import { SecureString } from '@webmud3/frontend/shared/types/secure-string';
import { OutputHistoryService } from '@webmud3/frontend/shared/services/output-history.service';
import { DebugSettingsService } from '@webmud3/frontend/features/debug/debug-settings.service';
import { hexDump } from '@webmud3/frontend/features/debug/hex-dump';
import { FooterMenuService } from '@webmud3/frontend/features/footer/footer-menu.service';
import { DirlistWindowService } from '@webmud3/frontend/features/editor/dirlist-window.service';
import { SoundService } from '@webmud3/frontend/features/sound/sound.service';
import { EditorWindowService } from '@webmud3/frontend/features/editor/editor-window.service';
import { InputCompletionService } from '@webmud3/frontend/features/gmcp/input-completion.service';
import { CharGmcpModule } from '@webmud3/frontend/features/gmcp/modules/char-gmcp.module';
import { InventoryWindowService } from '@webmud3/frontend/features/inventory/inventory-window.service';
import { ConnectionMenuService } from '@webmud3/frontend/features/connection/connection-menu.service';
import { NumpadWindowService } from '@webmud3/frontend/features/numpad/numpad-window.service';
import { PlayermapWindowService } from '@webmud3/frontend/features/playermap/playermap-window.service';
import { SettingsWindowService } from '@webmud3/frontend/features/settings/settings-window.service';
import { WindowService } from '@webmud3/frontend/features/windows/window.service';
import type { LinemodeState } from '@webmud3/shared';
import {
  MobileInputComponent,
  MudInputController,
  MudPromptManager,
  MudScreenReaderAnnouncer,
  MudSocketAdapter,
  MudPromptContext,
  ClickAction,
  MxpChoiceMenuComponent,
  MxpChoiceMenuService,
  MxpClickableService,
  MxpElementService,
  MxpEntityService,
  MxpSoundService,
  MxpStatService,
  MxpStreamFilter,
  MxpTagRouter,
  StreamSegment,
  SpeechSettingsService,
  TerminalThemeService,
  TERMINAL_THEME_ORDER,
  TERMINAL_THEMES,
  TerminalThemeDefinition,
  TerminalThemeId,
  CTRL,
  cursorLeft,
} from '../../../../features/terminal';

/**
 * Minimum number of columns the terminal must always be able to display.
 * UNItopia (and most MUDs) format their output for an 80-column terminal,
 * so the font size is sized down on narrow viewports until 80 columns fit.
 */
const TARGET_COLUMNS = 80;

/**
 * Approximate ratio of a monospaced glyph's advance width to the font size.
 * For JetBrainsMono this is roughly 0.6; we pick a slightly larger value so
 * the calculation errs on the side of "fits" rather than "one column missing".
 */
const CHAR_WIDTH_RATIO = 0.62;

/** Pixels of horizontal slack reserved for padding / scroll gutter. */
const TERMINAL_HORIZONTAL_PADDING = 8;

/** Hard limits for the terminal font size. */
const MIN_TERMINAL_FONT_SIZE = 6;
const MAX_TERMINAL_FONT_SIZE = 18;

/**
 * Component-internal shape that bundles the mutable Mud client flags.
 */
type MudClientState = {
  isEditMode: boolean;
  showEcho: boolean;
  localEchoEnabled: boolean;
  terminalReady: boolean;
  /**
   * When true, a native single-line input is rendered below the terminal and
   * xterm's keyboard input is ignored. Auto-enabled on touch devices because
   * Android soft keyboards do not cooperate with xterm's hidden textarea.
   */
  useMobileInput: boolean;
};

/**
 * Angular wrapper around the xterm-based MUD client.  The component hosts the terminal,
 * wires the input/prompt helpers together and mirrors socket events to the view. A
 * custom screenreader announcer replaces xterm's built-in screenReaderMode to avoid
 * duplicated output and replaying history after reconnects.
 */
@Component({
  selector: 'app-mud-client',
  standalone: true,
  imports: [MobileInputComponent, MxpChoiceMenuComponent],
  templateUrl: './mud-client.component.html',
  styleUrls: ['./mud-client.component.scss'],
})
export class MudClientComponent implements AfterViewInit, OnDestroy {
  private readonly mudService = inject(MudService);
  private readonly mudNotices = inject(MudNoticeService);
  private readonly outputHistoryService = inject(OutputHistoryService);
  private readonly debugSettings = inject(DebugSettingsService);
  private readonly speechSettings = inject(SpeechSettingsService);
  private readonly terminalThemes = inject(TerminalThemeService);
  private readonly footerMenu = inject(FooterMenuService);
  // Bootstraps the Char GMCP module (registers it with the GmcpService so that
  // "Char 1" is included in Core.Supports.Set sent to the MUD).
  private readonly _charGmcp = inject(CharGmcpModule);
  // Bootstraps the inventory feature: registers Char.Items GMCP module and
  // adds the "Inventar" toggle to the footer menu.
  private readonly _inventoryWindow = inject(InventoryWindowService);
  // Bootstraps the "Verbinden / Trennen" entry in the footer menu.
  private readonly _connectionMenu = inject(ConnectionMenuService);
  // Bootstraps the "Numpad-Konfiguration" entry in the footer menu and
  // loads numpad bindings from localStorage.
  private readonly _numpadWindow = inject(NumpadWindowService);
  // Bootstraps the editor feature: registers the Files GMCP module and
  // auto-opens an editor window whenever the MUD pushes Files.OpenFile.
  private readonly _editorWindow = inject(EditorWindowService);
  // Bootstraps the directory browser: shows a "Verzeichnis" footer menu
  // entry once Char.Name reports the connected player as a wizard.
  private readonly _dirlistWindow = inject(DirlistWindowService);
  // Bootstraps the sound feature: registers the Sound GMCP module and
  // plays files announced via Sound.Event against the Sound.Url base URL.
  // Also exposed via the "Sound" footer-menu toggle below.
  private readonly soundService = inject(SoundService);
  // Bootstraps the playermap feature: registers the Playermap GMCP module and
  // adds the "Karte" toggle to the footer menu.
  private readonly _playermapWindow = inject(PlayermapWindowService);
  // Bootstraps the settings dialog: registers the "Einstellungen…" footer
  // menu entry that opens a tabbed settings window.
  private readonly _settingsWindow = inject(SettingsWindowService);
  // Bootstraps the Input GMCP module and exposes the Input.Complete round-trip.
  private readonly inputCompletion = inject(InputCompletionService);
  private readonly windowService = inject(WindowService);
  private readonly mxpRouter = inject(MxpTagRouter);
  private readonly mxpEntities = inject(MxpEntityService);
  private readonly mxpStats = inject(MxpStatService);
  private readonly mxpElements = inject(MxpElementService);
  private readonly mxpClickables = inject(MxpClickableService);
  private readonly mxpChoiceMenu = inject(MxpChoiceMenuService);
  private readonly mxpSounds = inject(MxpSoundService);

  private readonly MOBILE_INPUT_MENU_ID = 'mobile-input';
  private readonly RECENTER_MENU_ID = 'windows-recenter';
  private readonly SOUND_MENU_ID = 'sound-enabled';
  /** Parent entry that hosts the five theme radio items as a flyout submenu. */
  private readonly THEME_PARENT_MENU_ID = 'terminal-theme';
  /** Menu-id prefix for the five terminal-theme radio entries. */
  private readonly THEME_MENU_PREFIX = 'terminal-theme:';

  private readonly terminal: Terminal;
  private readonly inputController: MudInputController;
  private readonly promptManager: MudPromptManager;
  private readonly mxpFilter = new MxpStreamFilter((raw) =>
    this.mxpRouter.handle(raw),
  );
  private screenReader?: MudScreenReaderAnnouncer;
  private readonly terminalClipboardAddon = new ClipboardAddon();
  private readonly terminalFitAddon = new FitAddon();
  private socketAdapter?: MudSocketAdapter;
  private terminalAttachAddon?: AttachAddon;
  private pendingEchoSuppression: string | null = null;

  private readonly terminalDisposables: IDisposable[] = [];
  private readonly resizeObs = new ResizeObserver(() => {
    this.handleTerminalResize();
  });

  private audioContext?: AudioContext;
  private audioUnlocked = false;
  private lastBellTime = 0;

  private readonly handleVisibilityChange = (): void => {
    if (!document.hidden && this.audioContext?.state === 'interrupted') {
      this.audioContext.resume().catch(() => {
        // Ignore errors on resume
      });
    }
  };

  private showEchoSubscription?: Subscription;
  private linemodeSubscription?: Subscription;
  private completionSubscriptions: Subscription[] = [];
  private noticeSubscription?: Subscription;
  private themeSubscription?: Subscription;
  private mxpResetSubscription?: Subscription;
  private pasteHandler?: (event: ClipboardEvent) => void;
  /** Read-only state accessor for template bindings. */
  public get useMobileInput(): boolean {
    return this.state.useMobileInput;
  }

  /** History provider passed to the mobile input component. */
  public get historyProvider(): MudInputController {
    return this.inputController;
  }

  /** Live state object used by the template. */
  public get viewState(): MudClientState {
    return this.state;
  }

  private state: MudClientState = {
    isEditMode: true,
    showEcho: true,
    localEchoEnabled: true,
    terminalReady: false,
    // Touch devices get the native single-line input by default so Android /
    // iOS soft keyboards behave correctly. Desktop users can opt in via the
    // footer menu.
    useMobileInput:
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches,
  };
  private lastViewportSize?: { columns: number; rows: number };

  @ViewChild('hostRef', { static: true })
  private readonly terminalRef!: ElementRef<HTMLDivElement>;

  @ViewChild('liveRegionRef', { static: true })
  private readonly liveRegionRef!: ElementRef<HTMLDivElement>;

  @ViewChild('inputRegionRef', { static: true })
  private readonly inputRegionRef!: ElementRef<HTMLDivElement>;

  @ViewChild('historyRegionRef', { static: true })
  private readonly historyRegionRef!: ElementRef<HTMLElement>;

  private helperTextarea: HTMLTextAreaElement | null = null;

  protected readonly isConnected$ = this.mudService.connectedToMud$;
  protected readonly showEcho$ = this.mudService.showEcho$;

  /**
   * Instantiates the terminal plus helper controllers.  All services (input/prompt)
   * share the same terminal instance.
   */
  constructor() {
    const initialTheme = this.terminalThemes.theme;
    this.terminal = new Terminal({
      fontFamily: 'JetBrainsMono, monospace',
      disableStdin: false,
      screenReaderMode: false,
      // Both `theme` and `minimumContrastRatio` come from the user-selected
      // entry in TerminalThemeService and are kept in sync at runtime via
      // the `theme$` subscription wired up in ngAfterViewInit.
      theme: initialTheme.theme,
      minimumContrastRatio: initialTheme.minimumContrastRatio,
      // Handles clicks on OSC 8 hyperlinks. MXP-clickable rexits etc. are
      // written into the buffer as `\x1b]8;;mxp:click/<id>\x1b\\…` — when
      // the user clicks one, xterm calls this handler with the URL string.
      // We resolve the id via MxpClickableService, which transparently
      // returns null for regions that have been expired (e.g. exits from
      // a previous room after a `<rexpire>`).
      //
      // `allowNonHttpProtocols: true` is required because our scheme is
      // `mxp:` — without it xterm silently blocks the click for security.
      linkHandler: {
        allowNonHttpProtocols: true,
        activate: (event, text) => {
          this.handleMxpHyperlinkClick(text, event);
        },
      },
    });

    this.inputController = new MudInputController(
      this.terminal,
      ({ message, echoed }) => this.handleCommittedInput(message, echoed),
      ({ buffer }) => this.announceInputToScreenReader(buffer),
      (buffer) => this.inputCompletion.requestCompletion(buffer),
    );
    this.inputController.setLocalEcho(this.state.localEchoEnabled);

    this.promptManager = new MudPromptManager(
      this.terminal,
      this.inputController,
    );
  }

  /**
   * Bootstraps the terminal after the view is ready: attaches addons, subscribes
   * to socket events and reports the initial viewport dimensions to the server.
   */
  ngAfterViewInit() {
    // Initialize screenreader announcer before terminal/socket setup
    // to ensure we capture the session start BEFORE any output arrives
    this.screenReader = new MudScreenReaderAnnouncer(
      this.liveRegionRef.nativeElement,
      this.historyRegionRef.nativeElement,
      this.inputRegionRef.nativeElement,
      () => this.debugSettings.screenReaderLogging,
      () => this.speechSettings.announceInputWord,
      () => this.speechSettings.announceInputCommit,
    );

    this.applyPoliteInputMode(this.speechSettings.politeInputMode);

    this.srLog(
      '[MudClient] Screenreader announcer initialized, live region:',
      this.liveRegionRef.nativeElement,
    );

    this.registerDebugMenuItems();

    // Now initialize socket adapter AFTER screenreader is ready
    this.socketAdapter = new MudSocketAdapter(this.mudService.mudOutput$, {
      rawMessage: (data) => this.logRawMudOutput(data),
      transformMessage: (data) => this.transformMudOutput(data),
      beforeMessage: (data) => this.beforeMudOutput(data),
      afterMessage: (data) => this.afterMudOutput(data),
    });

    this.terminalAttachAddon = new AttachAddon(
      this.socketAdapter as unknown as WebSocket,
      { bidirectional: false },
    );

    this.applyResponsiveFontSize(window.innerWidth);

    this.terminal.open(this.terminalRef.nativeElement);
    this.terminal.loadAddon(this.terminalClipboardAddon);
    this.terminal.loadAddon(this.terminalFitAddon);
    this.terminal.loadAddon(this.terminalAttachAddon);
    this.installCopyShortcutHandler();
    this.terminal.focus();

    // Cache helper textarea created by xterm (used to mirror prompt + input)
    this.helperTextarea =
      (this.terminalRef.nativeElement.querySelector(
        '.xterm-helper-textarea',
      ) as HTMLTextAreaElement | null) ?? null;

    // Set aria-label on helper textarea for better screen reader context
    if (this.helperTextarea) {
      this.helperTextarea.setAttribute('aria-label', 'Eingabe');
    }

    // Set up paste handler on terminal container (for native paste events)
    this.setupPasteHandler(this.terminalRef.nativeElement);

    this.terminalDisposables.push(
      this.terminal.onData((data) => this.handleInput(data)),
      this.terminal.onBell(() => this.playBell()),
    );

    this.showEchoSubscription = this.showEcho$.subscribe((showEcho) => {
      this.updateLocalEcho(showEcho);
    });

    this.linemodeSubscription = this.mudService.linemode$.subscribe((state) =>
      this.setLinemode(state),
    );

    this.completionSubscriptions.push(
      this.inputCompletion.text$.subscribe((text) =>
        this.handleInputCompleteText(text),
      ),
      this.inputCompletion.choices$.subscribe((choices) =>
        this.handleInputCompleteChoice(choices),
      ),
      this.inputCompletion.none$.subscribe(() =>
        this.handleInputCompleteNone(),
      ),
    );

    this.noticeSubscription = this.mudNotices.notices$.subscribe((text) =>
      this.writeLocalNotice(text),
    );

    this.themeSubscription = this.terminalThemes.theme$.subscribe((def) =>
      this.applyTerminalTheme(def),
    );

    // On every disconnect, drop MXP state so a fresh login starts with a
    // clean entity / stat map. The server resends both at init_mxp() time.
    this.mxpResetSubscription = this.mudService.connectedToMud$.subscribe(
      (connected) => {
        if (!connected) {
          this.mxpFilter.reset();
          this.mxpEntities.clear();
          this.mxpStats.clear();
          this.mxpElements.clear();
          this.mxpClickables.clear();
          this.mxpChoiceMenu.close();
          this.mxpSounds.clear();
          // Drop the GMCP-sound base URL too so a reconnect to a server
          // without the Sound module does not keep MXP-sound suppressed.
          this.soundService.gmcpReset();
        }
      },
    );

    this.resizeObs.observe(this.terminalRef.nativeElement);
    this.setState({ terminalReady: true });

    // Register visibility change listener to resume audio context when tab becomes visible
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    // Handle device rotation explicitly. Mobile browsers fire orientationchange
    // before innerWidth/innerHeight settle on the new dimensions, so we recompute
    // on the next frame; ResizeObserver may take an extra tick to fire and the
    // user briefly sees a misfitted terminal otherwise.
    window.addEventListener('orientationchange', this.handleOrientationChange);

    // Load history BEFORE connecting to MUD to ensure it appears before new output
    this.loadHistoryIfAvailable();

    const columns = this.terminal.cols;
    const rows = this.terminal.rows + 1;

    this.mudService.connect({ columns, rows });
  }

  /**
   * Cleans up subscriptions and disposes terminal resources.
   */
  ngOnDestroy() {
    this.footerMenu.unregister(this.MOBILE_INPUT_MENU_ID);
    this.footerMenu.unregister(this.RECENTER_MENU_ID);
    this.footerMenu.unregister(this.SOUND_MENU_ID);
    this.footerMenu.unregister(this.THEME_PARENT_MENU_ID);
    this.resizeObs.disconnect();

    // Unregister visibility change listener
    document.removeEventListener(
      'visibilitychange',
      this.handleVisibilityChange,
    );

    window.removeEventListener(
      'orientationchange',
      this.handleOrientationChange,
    );

    // Unregister paste handler
    if (this.pasteHandler) {
      if (this.terminalRef?.nativeElement) {
        this.terminalRef.nativeElement.removeEventListener(
          'paste',
          this.pasteHandler,
        );
      }
      document.removeEventListener('paste', this.pasteHandler);
    }

    this.terminalDisposables.forEach((disposable) => disposable.dispose());
    this.showEchoSubscription?.unsubscribe();
    this.linemodeSubscription?.unsubscribe();
    this.noticeSubscription?.unsubscribe();
    this.themeSubscription?.unsubscribe();
    this.mxpResetSubscription?.unsubscribe();
    for (const sub of this.completionSubscriptions) {
      sub.unsubscribe();
    }
    this.completionSubscriptions = [];

    this.terminalClipboardAddon.dispose();
    this.terminalAttachAddon?.dispose();
    this.socketAdapter?.dispose();
    this.terminal.dispose();

    // Close audio context if it was created
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {
        // Ignore errors on close
      });
    }
    this.screenReader?.dispose();
  }

  /**
   * Handles DOM resize events, updating xterm and notifying the backend whenever
   * the viewport size actually changes.
   */
  /**
   * Triggered after the user rotates the device. innerWidth/innerHeight are
   * not guaranteed to be final at the moment this event fires, so we defer the
   * actual resize to the next animation frame.
   */
  private handleOrientationChange = (): void => {
    requestAnimationFrame(() => {
      this.handleTerminalResize();
    });
  };

  private handleTerminalResize() {
    // Prefer the actual container width so paddings / sidebars don't trick
    // the calculation into using a font that's too large for the visible
    // terminal area. Falls back to window.innerWidth before the view exists.
    const containerWidth =
      this.terminalRef?.nativeElement?.clientWidth || window.innerWidth;

    this.applyResponsiveFontSize(containerWidth);
    this.terminalFitAddon.fit();

    const columns = this.terminal.cols;
    const rows = this.terminal.rows;

    if (
      !Number.isFinite(columns) ||
      !Number.isFinite(rows) ||
      columns <= 0 ||
      rows <= 0
    ) {
      return;
    }

    if (
      this.lastViewportSize?.columns === columns &&
      this.lastViewportSize?.rows === rows
    ) {
      return;
    }

    this.lastViewportSize = { columns, rows };

    this.mudService.updateViewportSize(columns, rows);
  }

  private applyResponsiveFontSize(viewportWidth: number): void {
    const nextFontSize = this.getFontSizeForWidth(viewportWidth);

    if (this.terminal.options.fontSize === nextFontSize) {
      return;
    }

    this.terminal.options.fontSize = nextFontSize;
  }

  /**
   * Picks the largest font size that still allows TARGET_COLUMNS to fit into
   * the given width. Result is clamped to [MIN, MAX] and snapped to half-pixel
   * steps so xterm doesn't oscillate between fractional values across resizes.
   *
   * On very narrow viewports (≲ 360 px) the returned size hits MIN; the
   * terminal will still be ≥ 80 columns at MIN_TERMINAL_FONT_SIZE.
   */
  private getFontSizeForWidth(viewportWidth: number): number {
    const usable = Math.max(0, viewportWidth - TERMINAL_HORIZONTAL_PADDING);
    const idealSize = usable / (TARGET_COLUMNS * CHAR_WIDTH_RATIO);
    const halfPixelSnapped = Math.floor(idealSize * 2) / 2;

    return Math.max(
      MIN_TERMINAL_FONT_SIZE,
      Math.min(MAX_TERMINAL_FONT_SIZE, halfPixelSnapped),
    );
  }

  /**
   * Sends a committed line (or secure string) to the server.
   */
  private handleCommittedInput(message: string, echoed: boolean) {
    const payload: string | SecureString = echoed
      ? message
      : { value: message };

    if (typeof payload === 'string') {
      const normalizedInput =
        this.screenReader?.normalizeForComparison(payload);

      this.pendingEchoSuppression = normalizedInput?.length
        ? normalizedInput
        : null;
      this.screenReader?.appendToHistory(payload);
    }

    this.mudService.sendMessage(payload);

    // Save the current prompt to history for session persistence
    const currentPrompt = this.promptManager.getCurrentPrompt();

    if (typeof payload === 'string') {
      // Persist with CRLF to match server formatting faithfully
      const storedMessage = `${currentPrompt}${payload}\r\n`;
      console.debug(
        `[MudClient] Saving input with prompt: ${currentPrompt} ${message}`,
      );
      this.outputHistoryService.appendInputLine(storedMessage);
    }

    // Clear helper textarea after commit
    this.updateHelperTextarea('');
  }

  /**
   * Receives a committed line from the native mobile input component.
   *
   * Mirrors what `MudInputController.commitBuffer` does for xterm-driven
   * input: locally echoes the line into xterm if local echo is on, records
   * it in command history (only when echoed — passwords stay out), then
   * routes through the same handler that processes xterm-committed lines.
   */
  public onMobileInputCommit(message: string): void {
    const echoed = this.state.localEchoEnabled;

    if (echoed) {
      // Render the line + CRLF into xterm so the user sees what they sent.
      this.terminal.write(`${message}\r\n`);
      // Share history with the xterm-driven input.
      this.inputController.recordHistoryEntry(message);
    }

    this.handleCommittedInput(message, echoed);
  }

  /**
   * Toggles the native mobile input on / off and registers the matching
   * footer-menu entry so desktop users can opt in.
   */
  private setUseMobileInput(enabled: boolean): void {
    if (this.state.useMobileInput === enabled) {
      this.footerMenu.setChecked(this.MOBILE_INPUT_MENU_ID, enabled);
      return;
    }

    this.setState({ useMobileInput: enabled });
    this.footerMenu.setChecked(this.MOBILE_INPUT_MENU_ID, enabled);

    if (!enabled) {
      // Refocus xterm so keystrokes flow back through onData.
      this.terminal.focus();
    }
  }

  /**
   * Announces input buffer changes to the screen reader announcer.
   * Called whenever the user types, deletes, etc. (but not for cursor-only moves).
   * This ensures screen reader users can hear their input in real-time.
   */
  private announceInputToScreenReader(buffer: string): void {
    this.screenReader?.announceInput(buffer);
    this.updateHelperTextarea(buffer);
  }

  /**
   * Routes terminal keystrokes either directly to the socket (when not in edit mode)
   * or through the {@link MudInputController}.
   * Special handling for Ctrl+V: intercepts clipboard content and injects it properly.
   */
  private handleInput(data: string) {
    this.pasteLog('[PASTE-DEBUG] Edit mode:', this.state.isEditMode);
    this.pasteLog('[PASTE-DEBUG] Data received:', JSON.stringify(data));
    this.pasteLog('[PASTE-DEBUG] Data length:', data.length);

    // When the native mobile input is active, ignore everything xterm thinks
    // the user typed — input flows through the <app-mobile-input> commit
    // handler instead. This avoids double processing if a stray focus brings
    // the hidden helper textarea back into play on touch devices.
    if (this.state.useMobileInput) {
      return;
    }

    // Special handling for Ctrl+V (paste): xterm converts paste to \u0016 in onData()
    // We need to read the clipboard and inject the actual content
    if (data === '\u0016') {
      this.pasteLog(
        '[MudClient] Ctrl+V detected, reading clipboard from native event...',
      );
      this.handlePasteFromClipboard();
      return;
    }

    // Unlock audio context on first user interaction (browser autoplay policy)
    if (!this.audioUnlocked) {
      this.unlockAudio();
    }

    if (!this.state.isEditMode) {
      if (data.length > 0) {
        const rewritten = this.rewriteBackspaceToDelete(data);
        this.mudService.sendMessage(rewritten);
      }

      return;
    }

    this.inputController.handleData(data);
  }

  /**
   * Handles `Input.CompleteText` GMCP responses: the MUD found a unique
   * completion. We replace the controller's buffer so the visible input line
   * shows the completed command, ready for Enter.
   */
  private handleInputCompleteText(text: string): void {
    if (!this.state.isEditMode) {
      return;
    }
    this.inputController.replaceBuffer(text);
  }

  /**
   * Handles `Input.CompleteChoice` GMCP responses (wizard-only): the MUD
   * returned several candidates. We print the list above the current input
   * line and repaint the prompt+buffer so the user keeps typing seamlessly.
   * We don't pick a "longest common prefix" for the user; that's a UI-policy
   * call and easy to add later if wanted.
   */
  private handleInputCompleteChoice(choices: string[]): void {
    if (!this.state.isEditMode || choices.length === 0) {
      return;
    }

    const snapshot = this.inputController.getSnapshot();
    const prompt = this.promptManager.getCurrentPrompt();
    const formatted = choices.join(', ');

    // The cursor is currently at the end of the visible <prompt><buffer>
    // line. CR + LF moves us to a fresh line; print the choice list, another
    // CRLF, then redraw <prompt><buffer> below it. Reposition the cursor if
    // the user had it mid-buffer.
    let output = `\r\n${formatted}\r\n${prompt}${snapshot.buffer}`;
    const moveLeft = snapshot.buffer.length - snapshot.cursor;
    if (moveLeft > 0) {
      output += cursorLeft(moveLeft);
    }
    this.terminal.write(output);
  }

  /**
   * Handles `Input.CompleteNone`: nothing to complete. Ring the terminal
   * bell so the user gets the familiar "no match" feedback without us
   * touching the input line.
   */
  private handleInputCompleteNone(): void {
    this.terminal.write('\x07');
  }

  /**
   * Applies the given theme definition to the live xterm instance. Both
   * `theme` and `minimumContrastRatio` are part of `Terminal.options`, so
   * the change takes effect immediately without re-creating the terminal.
   * Called both on init (with the persisted choice) and whenever the user
   * picks a different theme via the footer menu.
   */
  private applyTerminalTheme(def: TerminalThemeDefinition): void {
    this.terminal.options.theme = def.theme;
    this.terminal.options.minimumContrastRatio = def.minimumContrastRatio;
  }

  /**
   * Renders a locally-generated notice (e.g. "[Datei xyz.c gespeichert]")
   * into the MUD terminal. Coloured cyan + bold so the user can tell client
   * messages from real server output, framed with CRLFs so it always lands
   * on its own line — even when the server output ended mid-line.
   *
   * The notice also goes through the prompt manager hooks (before/after) so
   * any locally-echoed user input is hidden during the write and restored
   * afterwards, matching the behaviour for normal server output.
   */
  private writeLocalNotice(text: string): void {
    const ctx = this.getPromptContext();
    this.promptManager.beforeServerOutput(ctx);

    // ESC[1;36m = bold cyan, ESC[0m = reset.
    const styled = `${CTRL.ESC}[1;36m${text}${CTRL.ESC}[0m\r\n`;
    this.terminal.write(styled);

    this.promptManager.afterServerOutput(styled, ctx);
    this.screenReader?.announce(text);
    this.screenReader?.appendToHistory(text);
  }

  /**
   * Applies the negotiated LINEMODE.  Pending local input is flushed before
   * leaving edit mode; both prompt and controller state are reset afterwards.
   */
  private setLinemode(state: LinemodeState) {
    const wasEditMode = this.state.isEditMode;

    if (!state.edit) {
      if (wasEditMode) {
        const pending = this.inputController.flush();

        if (pending) {
          this.handleCommittedInput(pending.message, pending.echoed);
        }
      }

      this.inputController.reset();
    } else if (!wasEditMode) {
      this.inputController.reset();
    }

    this.setState({ isEditMode: state.edit });
    this.promptManager.reset();
    this.updateLocalEcho(this.state.showEcho);
  }

  /**
   * Enables/disables local echo and informs the input controller.  The effective
   * value depends on both LINEMODE and the server-provided flag.
   */
  private updateLocalEcho(showEcho: boolean) {
    const localEchoEnabled = this.state.isEditMode && showEcho;

    this.setState({ showEcho, localEchoEnabled });
    this.inputController.setLocalEcho(localEchoEnabled);
  }

  /**
   * Delegates to the prompt manager so it can temporarily hide the local prompt.
   */
  private beforeMudOutput(_data: string) {
    this.promptManager.beforeServerOutput(this.getPromptContext());
  }

  /**
   * Restores prompt and user input after the server chunk has been rendered.
   */
  private afterMudOutput(data: string) {
    this.promptManager.afterServerOutput(data, this.getPromptContext());
    this.announceToScreenReader(data);
    this.screenReader?.appendToHistory(data);
    this.updateHelperTextarea();
  }

  /**
   * Stream pipeline for server output:
   *   1. Prompt manager strips a leading CR/LF if its `stripNextLineBreak`
   *      flag is set (called once per chunk before MXP processing — the
   *      flag's effect is on the very first character anyway).
   *   2. MXP filter splits the cleaned chunk into segments (`text` /
   *      `clickable`).
   *   3. Each segment is written into xterm via `terminal.write` directly;
   *      clickable segments are emitted as OSC 8 hyperlinks so xterm
   *      tracks their position natively as the buffer scrolls.
   *
   * Returning `''` suppresses AttachAddon's own write — we already pushed
   * everything ourselves.
   */
  private transformMudOutput(data: string): string {
    const cleaned = this.promptManager.transformOutput(data);
    const segments = this.mxpFilter.processToSegments(cleaned);

    for (const seg of segments) {
      if (seg.type === 'text') {
        this.terminal.write(seg.content);
      } else {
        this.writeClickableSegment(seg);
      }
    }

    return '';
  }

  /**
   * Writes a clickable segment into xterm as an OSC 8 hyperlink wrapped
   * in ANSI underline codes.
   *
   * Why OSC 8 instead of a LinkProvider: the hyperlink is part of the
   * buffer payload itself, so xterm tracks its position natively as the
   * buffer scrolls. No marker, no `viewportY` arithmetic, no async cursor
   * snapshotting — the previous implementation got the position wrong
   * after the buffer scrolled because the cursor measurements were
   * coupled to `viewportY` in a way that diverged from xterm's internal
   * hover-rendering coordinates.
   *
   * Format: `ESC]8;;mxp:click/<id>ESC\\ESC[4m<content>ESC[24mESC]8;;ESC\\`
   *   - The OSC 8 prefix declares an `mxp:click/<id>` URL.
   *   - `ESC[4m`/`ESC[24m` keep the visible underline so the region is
   *     obvious even without hovering.
   *   - The OSC 8 suffix closes the hyperlink range.
   *
   * The click is routed through the terminal's `linkHandler` callback
   * (set in the constructor); `MxpClickableService.lookup` decides
   * whether the click is still valid — clicks on rexits from a previous
   * room (whose epoch has been bumped by `<rexpire>`) silently no-op.
   */
  private writeClickableSegment(
    seg: Extract<StreamSegment, { type: 'clickable' }>,
  ): void {
    if (seg.content.length === 0) {
      return;
    }

    const action = this.deriveClickAction(seg);
    if (action === null) {
      // No actionable mapping — still write the content as plain text so
      // it doesn't get dropped from the visible stream.
      this.terminal.write(seg.content);
      return;
    }

    const id = this.mxpClickables.register(
      action.action,
      action.label,
      action.expireDomain,
    );

    const url = `mxp:click/${id}`;
    // OSC 8 hyperlinks: open + content (with ANSI underline) + close.
    // ST = `ESC \` (string terminator). xterm.js parses both BEL and ST,
    // we use ST because it's the form the OSC 8 spec recommends.
    this.terminal.write(
      `\x1b]8;;${url}\x1b\\\x1b[4m${seg.content}\x1b[24m\x1b]8;;\x1b\\`,
    );
  }

  /**
   * Called by the terminal's `linkHandler` when the user clicks an OSC 8
   * hyperlink in the buffer. Routes back to `activateClickRegion` for
   * MXP-managed links; ignores everything else (UNItopia may emit OSC 8
   * hyperlinks for other purposes in the future).
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
      // Region was expired by a domain switch — silently swallow the
      // click so an old scrollback exit doesn't move the player.
      return;
    }
    this.activateClickRegion(region.action, event);
  }

  /**
   * Computes what should happen when the user clicks the given clickable
   * segment. Returns `null` for segments we cannot resolve (e.g. an
   * `ircontent` whose `<!ELEMENT>` definition the server never sent).
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
      // UNItopia's <!ELEMENT rexit '<send expire="room">' …> binds room
      // exits to the "room" expire domain. We do not route rexit through
      // mxpElements.resolve() because the template has no `href` (the
      // visible content is itself the command), but we still inherit the
      // expire domain so the server's <expire name="room"> after a move
      // invalidates these regions.
      return {
        action: { kind: 'simple', command },
        label: command,
        expireDomain: 'room',
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
      return { action: { kind: 'simple', command: '' }, label: '', expireDomain: expire };
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

  /**
   * Diagnostic: when the "Output Hex-Log" debug toggle is active, dump every
   * raw chunk arriving from the MUD as a hex+printable block so we can see
   * exactly which bytes the browser receives. Used to track down "missing
   * characters" issues that depend on user-specific server settings.
   */
  private logRawMudOutput(data: string): void {
    if (!this.debugSettings.outputHexLogging) {
      return;
    }

    console.groupCollapsed(
      `[MudOutput] chunk len=${data.length} (${new Blob([data]).size} bytes UTF-8)`,
    );
    console.log(hexDump(data));
    console.log('raw string:', JSON.stringify(data));
    console.groupEnd();
  }

  /**
   * Builds the prompt context consumed by the prompt manager.
   */
  private getPromptContext(): MudPromptContext {
    return {
      isEditMode: this.state.isEditMode,
      terminalReady: this.state.terminalReady,
      localEchoEnabled: this.state.localEchoEnabled,
    };
  }

  /**
   * Announces new server output via the custom screenreader announcer.
   * Called AFTER prompt restoration so we announce the final visible text.
   */
  private announceToScreenReader(data: string): void {
    if (!this.screenReader) {
      return;
    }

    const normalizedOutput = this.screenReader.normalizeForComparison(data);

    if (
      this.pendingEchoSuppression &&
      normalizedOutput === this.pendingEchoSuppression
    ) {
      this.pendingEchoSuppression = null;
      return;
    }

    if (normalizedOutput) {
      this.pendingEchoSuppression = null;
    }

    this.srLog('[MudClient] Announcing to screenreader:', {
      rawLength: data.length,
      raw: data,
    });

    this.screenReader.announce(data);
  }

  /**
   * Convenience helper for patching the local state object.
   */
  private setState(patch: Partial<MudClientState>): void {
    this.state = { ...this.state, ...patch };
  }

  /**
   * Loads and displays saved output history if available.
   * Fills the screenreader history region with old entries (silently, no announcement).
   * Resets the screenreader session timestamp so new output isn't filtered as "too old".
   */
  private loadHistoryIfAvailable(): void {
    console.log('[MudClient] Loading history from localStorage');

    const entries = this.outputHistoryService.loadEntries();

    if (entries.length === 0) {
      console.log('[MudClient] No history found');
      return;
    }

    console.log(`[MudClient] Restoring ${entries.length} entries from history`);

    // Write all history entries to terminal in order
    for (const entry of entries) {
      this.terminal.write(entry.data);

      // Also append to screenreader history region (silent, no live announcement)
      // this.screenReader?.appendToHistory(entry.data);
    }

    this.srLog(
      '[MudClient] History loaded to terminal and screenreader history',
    );
  }

  /**
   * Plays a short synthesized beep using AudioContext.
   * Implements debouncing to prevent bell spam (100ms minimum interval).
   */
  private async playBell(): Promise<void> {
    const BELL_DEBOUNCE_MS = 100;
    const now = Date.now();
    if (now - this.lastBellTime < BELL_DEBOUNCE_MS) return;
    this.lastBellTime = now;

    const ctx = this.audioContext;
    if (!ctx || ctx.state === 'closed') return;

    try {
      // Wichtig: suspended behandeln
      if (ctx.state === 'suspended') {
        await ctx.resume(); // kann in manchen Browsern ohne User-Geste fehlschlagen
      }

      // Falls resume nicht geklappt hat
      if (ctx.state !== 'running') return;

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = 800;

      const t = ctx.currentTime;

      // Kleine Lautstärke-Hüllkurve (Attack/Decay), um Klickgeräusche beim Starten/Stoppen zu vermeiden
      gainNode.gain.setValueAtTime(0.0001, t); // leise starten
      gainNode.gain.exponentialRampToValueAtTime(0.3, t + 0.005); // schneller Attack
      gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); // sanfter Fade-out

      oscillator.start(t);
      oscillator.stop(t + 0.11);

      oscillator.onended = () => {
        oscillator.disconnect();
        gainNode.disconnect();
      };
    } catch (err) {
      console.debug('[MudClient] Bell playback failed:', err);
    }
  }

  /**
   * Initializes the AudioContext to comply with browser autoplay policy.
   * Must be called in response to a user gesture (e.g., first keypress).
   */
  private unlockAudio(): void {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
      }

      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch((err) => {
          console.debug('[MudClient] Audio context resume failed:', err);
        });
      }

      this.audioUnlocked = true;
    } catch (err) {
      console.debug('[MudClient] Audio context initialization failed:', err);
      this.audioUnlocked = false;
    }
  }

  /**
   *  this.terminal.write(entry.data);
    }
  }

  /**
   * Maps DEL to BACKSPACE for non-edit mode
   */
  private rewriteBackspaceToDelete(data: string): string {
    const containsDelete = data.includes(CTRL.DEL);

    if (containsDelete) {
      // Many terminals internally map Backspace to Delete; mirror that when bypassing edit mode.
      return CTRL.BS;
    }

    return data;
  }

  /**
   * Mirrors the current prompt + buffer into xterm's helper textarea
   * so screen readers can inspect the input line.
   */
  private updateHelperTextarea(buffer?: string): void {
    if (!this.helperTextarea) {
      return;
    }

    const prompt = this.promptManager.getCurrentPrompt();
    const effectiveBuffer =
      buffer !== undefined ? buffer : this.inputController.getSnapshot().buffer;

    this.helperTextarea.value = `${prompt}${effectiveBuffer ?? ''}`;
  }

  /**
   * Wires up Ctrl+C / Cmd+C as a copy-to-clipboard shortcut for terminal text
   * selections.
   *
   * xterm's `attachCustomKeyEventHandler` runs before its own key processing.
   * Returning `false` swallows the event entirely, so the keystroke is not
   * forwarded to onData (and therefore not to the MUD).
   *
   * Behaviour:
   *  - Ctrl+C (Linux/Win) or Cmd+C (Mac) with active terminal selection:
   *    copy the selection and swallow the event.
   *  - Ctrl+C without selection: bubble through (preserves the existing
   *    behaviour of sending  to the MUD as an interrupt).
   *  - Anything else: bubble through.
   */
  /**
   * Handles a click on an MXP region.
   *
   *  - `simple` action: send the single command immediately.
   *  - `choice` action: open the choice-menu at the click coordinates and
   *    let the user pick. Picking sends the chosen command; Esc / outside-
   *    click cancels.
   */
  private activateClickRegion(action: ClickAction, event: MouseEvent): void {
    if (action.kind === 'simple') {
      if (!action.command) return;
      this.mudService.sendMessage(action.command);
      return;
    }

    if (action.commands.length === 0) {
      return;
    }

    this.mxpChoiceMenu.open({
      commands: action.commands,
      x: event.clientX,
      y: event.clientY,
      onPick: (command) => this.mudService.sendMessage(command),
    });
  }

  private installCopyShortcutHandler(): void {
    this.terminal.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') {
        return true;
      }

      // History navigation: Up/Down (with optional Alt for prefix filter) only
      // makes sense in line-edit mode. We handle it directly on the
      // KeyboardEvent because some browsers/OSes swallow Alt+ArrowUp/Down
      // before xterm sees it via onData.
      if (
        this.state.isEditMode &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        (event.key === 'ArrowUp' || event.key === 'ArrowDown')
      ) {
        if (event.key === 'ArrowUp') {
          this.inputController.historyBack(event.altKey);
        } else {
          this.inputController.historyForward(event.altKey);
        }

        event.preventDefault();
        return false;
      }

      const isCopyShortcut =
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        !event.altKey &&
        (event.key === 'c' || event.key === 'C');

      if (!isCopyShortcut || !this.terminal.hasSelection()) {
        return true;
      }

      const selection = this.terminal.getSelection();

      if (selection) {
        void navigator.clipboard.writeText(selection).catch((err) => {
          console.warn('[MudClient] Clipboard write failed:', err);
        });
      }

      // Prevent the browser default (which would also try to copy from xterm's
      // hidden helper textarea and may end up empty) and stop xterm from
      // emitting  as input.
      event.preventDefault();
      return false;
    });
  }

  /**
   * Sets up a paste event handler to intercept native clipboard paste operations.
   * This method listens on the terminal container for paste events that come
   * directly from the browser (Ctrl+V, right-click paste, etc.) without requiring
   * explicit clipboard API permissions.
   *
   * The paste event automatically includes clipboard access through event.clipboardData,
   * so no navigator.clipboard.readText() call is needed.
   */
  private setupPasteHandler(element: HTMLElement): void {
    this.pasteHandler = (event: ClipboardEvent) => {
      this.pasteLog('[MudClient] Native paste event intercepted');

      // Don't prevent default for now - let xterm handle the visual part
      // We'll just read the clipboard data and inject it properly
      const pastedText = event.clipboardData?.getData('text/plain');

      this.pasteLog('[MudClient] Clipboard content:', {
        length: pastedText?.length ?? 0,
        preview: pastedText?.substring(0, 50),
      });

      if (pastedText) {
        // Prevent the default onData behavior (which sends \u0016 only)
        event.preventDefault();

        if (!this.state.isEditMode) {
          // In non-edit mode, send paste content directly to server
          this.mudService.sendMessage(pastedText);
        } else {
          // In edit mode, route through input controller for buffering and echo
          this.inputController.handleData(pastedText);
        }
      }
    };

    element.addEventListener('paste', this.pasteHandler);
  }

  /**
   * Handles paste by reading clipboard content when Ctrl+V is detected.
   * Uses the Clipboard API which is safe to call here since it's triggered
   * by a user gesture (Ctrl+V keypress).
   */
  private async handlePasteFromClipboard(): Promise<void> {
    try {
      const pastedText = await navigator.clipboard.readText();

      this.pasteLog('[MudClient] Clipboard content read:', {
        length: pastedText.length,
        preview: pastedText.substring(0, 50),
      });

      if (pastedText) {
        if (!this.state.isEditMode) {
          // In non-edit mode, send paste content directly to server
          this.mudService.sendMessage(pastedText);
        } else {
          // In edit mode, route through input controller for buffering and echo
          this.inputController.handleData(pastedText);
        }
      }
    } catch (err) {
      console.error('[MudClient] Failed to read clipboard:', err);
    }
  }

  /** Logs only when screenreader debug logging is enabled in the footer menu. */
  private srLog(...args: unknown[]): void {
    if (this.debugSettings.screenReaderLogging) {
      console.debug(...args);
    }
  }

  /** Logs only when paste debug logging is enabled in the footer menu. */
  private pasteLog(...args: unknown[]): void {
    if (this.debugSettings.pasteLogging) {
      console.debug(...args);
    }
  }

  /**
   * Registers the directly-toggled footer menu entries (Sound, Mobile-Input,
   * Theme submenu, "Fenster ins Bild"). Speech / debug toggles live in the
   * settings dialog (`SettingsWindowService`) so they don't clutter the
   * footer menu — pre-Option-4 the footer had ~20 entries which was
   * unwieldy.
   */
  private registerDebugMenuItems(): void {
    this.footerMenu.register({
      id: this.MOBILE_INPUT_MENU_ID,
      label: 'Eingabezeile (Mobile)',
      checked: this.state.useMobileInput,
      action: () => this.setUseMobileInput(!this.state.useMobileInput),
    });

    // Action entry (no checkbox state) — used as a panic button when a
    // window has been dragged off-screen or became unreachable after a
    // viewport shrink. Pulls every open window back inside the viewport.
    this.footerMenu.register({
      id: this.RECENTER_MENU_ID,
      label: 'Fenster ins Bild',
      checked: false,
      action: () => this.windowService.bringAllIntoView(),
    });

    this.footerMenu.register({
      id: this.SOUND_MENU_ID,
      label: 'Sound',
      checked: this.soundService.enabled,
      action: () => this.soundService.toggle(),
    });

    // Terminal-theme radio group as a one-level submenu. Clicking the parent
    // expands the flyout; clicking a child switches the theme. The themeId$
    // subscription below keeps every entry's `checked` state in sync so the
    // menu always reflects the active choice.
    const activeThemeId = this.terminalThemes.themeId;
    this.footerMenu.register({
      id: this.THEME_PARENT_MENU_ID,
      label: 'Farben',
      // Pin to the very top of the menu regardless of registration order —
      // window-services etc. register without an explicit `order` and use
      // the DEFAULT_MENU_ORDER (100), so any value below that wins.
      order: 0,
      children: TERMINAL_THEME_ORDER.map((id) => {
        const def = TERMINAL_THEMES[id];
        return {
          id: `${this.THEME_MENU_PREFIX}${id}`,
          label: def.label,
          checked: id === activeThemeId,
          action: () => this.terminalThemes.setTheme(id),
        };
      }),
    });

    this.soundService.enabled$.subscribe((enabled) => {
      this.footerMenu.setChecked(this.SOUND_MENU_ID, enabled);
    });

    this.terminalThemes.themeId$.subscribe((activeId) => {
      for (const id of TERMINAL_THEME_ORDER) {
        this.footerMenu.setChecked(
          `${this.THEME_MENU_PREFIX}${id}`,
          id === activeId,
        );
      }
    });

    // Polite-input-mode lives in the settings dialog now, but we still have
    // to react to changes here because the actual aria-live attribute on
    // the input region is owned by this component.
    this.speechSettings.politeInputMode$.subscribe((enabled) => {
      this.applyPoliteInputMode(enabled);
    });
  }

  /**
   * Sets the `aria-live` attribute on the input region to either `polite`
   * (Safari-friendly) or `assertive` (default, interrupts current speech).
   * Called both at init and whenever the user toggles the corresponding
   * footer menu entry.
   */
  private applyPoliteInputMode(polite: boolean): void {
    const region = this.inputRegionRef?.nativeElement;
    if (!region) return;

    region.setAttribute('aria-live', polite ? 'polite' : 'assertive');
  }
}
