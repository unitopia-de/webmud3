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
import { SecureString } from '@webmud3/frontend/shared/types/secure-string';
import { OutputHistoryService } from '@webmud3/frontend/shared/services/output-history.service';
import type { LinemodeState } from '@webmud3/shared';
import {
  MudInputController,
  MudPromptManager,
  MudScreenReaderAnnouncer,
  MudSocketAdapter,
  MudPromptContext,
  CTRL,
} from '../../../../features/terminal';
import { ColorSettingsService } from '../../../../features/settings/color-settings.service';
import { InputGmcpHandler } from '../../../../features/gmcp-input/input-gmcp-handler';

/**
 * Component-internal shape that bundles the mutable Mud client flags.
 */
type MudClientState = {
  isEditMode: boolean;
  showEcho: boolean;
  localEchoEnabled: boolean;
  terminalReady: boolean;
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
  templateUrl: './mud-client.component.html',
  styleUrls: ['./mud-client.component.scss'],
})
export class MudClientComponent implements AfterViewInit, OnDestroy {
  private readonly mudService = inject(MudService);
  private readonly outputHistoryService = inject(OutputHistoryService);
  private readonly colorSettingsService = inject(ColorSettingsService);
  private readonly inputGmcpHandler = inject(InputGmcpHandler);

  private readonly fontSizeBreakpoints = [
    { minWidth: 0, fontSize: 8.5 },
    { minWidth: 420, fontSize: 9 },
    { minWidth: 470, fontSize: 10 },
    { minWidth: 520, fontSize: 11 },
    { minWidth: 570, fontSize: 12 },
    { minWidth: 620, fontSize: 13 },
    { minWidth: 670, fontSize: 14 },
    { minWidth: 720, fontSize: 15 },
    { minWidth: 770, fontSize: 16 },
  ];

  private readonly terminal: Terminal;
  private readonly inputController: MudInputController;
  private readonly promptManager: MudPromptManager;
  private screenReader?: MudScreenReaderAnnouncer;
  private readonly terminalClipboardAddon = new ClipboardAddon();
  private readonly terminalFitAddon = new FitAddon();
  private socketAdapter?: MudSocketAdapter;
  private terminalAttachAddon?: AttachAddon;

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
  private colorSettingsSubscription?: Subscription;
  private completionSubscription?: Subscription;
  private pasteHandler?: (event: ClipboardEvent) => void;
  private state: MudClientState = {
    isEditMode: true,
    showEcho: true,
    localEchoEnabled: true,
    terminalReady: false,
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
    this.terminal = new Terminal({
      fontFamily: 'JetBrainsMono, monospace',
      theme: this.colorSettingsService.getXtermTheme(),
      disableStdin: false,
      screenReaderMode: false,
    });

    this.inputController = new MudInputController(
      this.terminal,
      ({ message, echoed }) => this.handleCommittedInput(message, echoed),
      ({ buffer }) => this.announceInputToScreenReader(buffer),
    );
    this.inputController.setLocalEcho(this.state.localEchoEnabled);

    // Wire up tab-completion
    this.inputController.setTabCompleteHandler(({ word }) => {
      if (word.length > 0) {
        this.inputGmcpHandler.requestCompletion(word);
      }
    });

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
    );

    console.debug(
      '[MudClient] Screenreader announcer initialized, live region:',
      this.liveRegionRef.nativeElement,
    );

    // Now initialize socket adapter AFTER screenreader is ready
    this.socketAdapter = new MudSocketAdapter(this.mudService.mudOutput$, {
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

    // Apply color theme changes live
    this.colorSettingsSubscription = this.colorSettingsService.settings$.subscribe(() => {
      this.terminal.options.theme = this.colorSettingsService.getXtermTheme();
    });

    // Handle tab-completion results
    this.completionSubscription = this.inputGmcpHandler.completionResult$.subscribe(result => {
      switch (result.type) {
        case 'text':
          if (result.value !== undefined) {
            this.inputController.replaceCurrentWord(result.value);
          }
          break;
        case 'choice':
          // TODO: Show completion overlay (Phase 3.1 follow-up)
          console.info('[MudClient] Completion choices:', result.options);
          break;
        case 'none':
          // No completion available — optionally beep
          break;
      }
    });

    this.resizeObs.observe(this.terminalRef.nativeElement);
    this.setState({ terminalReady: true });

    // Register visibility change listener to resume audio context when tab becomes visible
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

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
    this.resizeObs.disconnect();

    // Unregister visibility change listener
    document.removeEventListener(
      'visibilitychange',
      this.handleVisibilityChange,
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
    this.colorSettingsSubscription?.unsubscribe();
    this.completionSubscription?.unsubscribe();

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
  private handleTerminalResize() {
    this.applyResponsiveFontSize(window.innerWidth);
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

  private getFontSizeForWidth(viewportWidth: number): number {
    let match = this.fontSizeBreakpoints[0]?.fontSize ?? 14;

    for (const breakpoint of this.fontSizeBreakpoints) {
      if (viewportWidth >= breakpoint.minWidth) {
        match = breakpoint.fontSize;
      }
    }

    return match;
  }

  /**
   * Sends a committed line (or secure string) to the server.
   */
  private handleCommittedInput(message: string, echoed: boolean) {
    const payload: string | SecureString = echoed
      ? message
      : { value: message };

    if (typeof payload === 'string') {
      this.screenReader?.appendToHistory(payload);
      // Announce the complete input so user can verify what they typed
      this.screenReader?.announceInputCommitted(payload);
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
    console.log('[PASTE-DEBUG] Edit mode:', this.state.isEditMode);
    console.log('[PASTE-DEBUG] Data received:', JSON.stringify(data));
    console.log('[PASTE-DEBUG] Data length:', data.length);

    // Special handling for Ctrl+V (paste): xterm converts paste to \u0016 in onData()
    // We need to read the clipboard and inject the actual content
    if (data === '\u0016') {
      console.log(
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
   * Lets the prompt manager strip redundant CR/LF characters.
   */
  private transformMudOutput(data: string): string {
    return this.promptManager.transformOutput(data);
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

    console.debug('[MudClient] Announcing to screenreader:', {
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

    console.log(
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
      console.log('[MudClient] Native paste event intercepted');

      // Don't prevent default for now - let xterm handle the visual part
      // We'll just read the clipboard data and inject it properly
      const pastedText = event.clipboardData?.getData('text/plain');

      console.log('[MudClient] Clipboard content:', {
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

      console.log('[MudClient] Clipboard content read:', {
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
}
