const DEFAULT_CLEAR_DELAY_MS = 300;
const INPUT_CLEAR_DELAY_MS = 700;
const ANSI_ESCAPE_PATTERN = /\x1B\[[0-9;?]*[ -\/]*[@-~]/g;
const CONTROL_CHAR_PATTERN = /[\x00-\x08\x0B-\x1F\x7F]/g;

/**
 * Minimal screenreader announcer tailored for xterm output.
 *
 * Responsibilities:
 * - Announce only new chunks (based on session start timestamp)
 * - Normalize data by stripping control / ANSI sequences
 * - Clear the live region shortly after announcing to avoid re-reading history
 */
export class MudScreenReaderAnnouncer {
  private clearTimer: number | undefined;
  private inputClearTimer: number | undefined;
  private sessionStartedAt: number;
  private lastAnnouncedBuffer = '';

  constructor(
    private readonly liveRegion: HTMLElement,
    private readonly historyRegion?: HTMLElement,
    private readonly inputRegion?: HTMLElement,
    private readonly inputCommittedRegion?: HTMLElement,
    private readonly clearDelayMs: number = DEFAULT_CLEAR_DELAY_MS,
  ) {
    this.sessionStartedAt = Date.now();
  }

  /**
   * Marks the current connection session start and clears any pending output.
   */
  public markSessionStart(timestamp: number = Date.now()): void {
    this.sessionStartedAt = timestamp;
    this.clear();
    this.clearHistory();
  }

  /**
   * Announces sanitized output to the aria-live region when it is newer than the current session.
   */
  public announce(raw: string, receivedAt: number = Date.now()): void {
    if (receivedAt < this.sessionStartedAt) {
      console.debug(
        '[ScreenReader] Ignoring old output (before session start):',
        {
          receivedAt,
          sessionStartedAt: this.sessionStartedAt,
          diff: receivedAt - this.sessionStartedAt,
        },
      );
      return;
    }

    const normalized = this.normalize(raw);

    console.debug('[ScreenReader] Announcing:', {
      raw: raw.substring(0, 100),
      normalized: normalized.substring(0, 100),
    });

    if (!normalized) {
      console.debug('[ScreenReader] Skipped empty normalized output');
      return;
    }

    this.liveRegion.textContent = normalized;
    console.debug(
      '[ScreenReader] Live region updated:',
      this.liveRegion.textContent,
    );
    this.scheduleClear();
  }

  /**
   * Clears the live region and any pending timers.
   */
  public clear(): void {
    this.liveRegion.textContent = '';
    this.cancelClearTimer();
  }

  /**
   * Disposes internal timers.
   */
  public dispose(): void {
    this.clear();
    this.cancelInputClearTimer();
  }

  /**
   * Appends sanitized text to the history region so users can navigate it later.
   */
  public appendToHistory(raw: string): void {
    if (!this.historyRegion) {
      return;
    }

    const normalized = this.normalize(raw);
    if (!normalized) {
      return;
    }

    const doc = this.historyRegion.ownerDocument;

    const item = doc.createElement('div');
    item.className = 'sr-log-item';
    item.textContent = normalized;

    this.historyRegion.appendChild(item);
  }

  /**
   * Clears the history region entirely (e.g., on reconnect).
   */
  public clearHistory(): void {
    if (this.historyRegion) {
      this.historyRegion.textContent = '';
    }
  }

  /**
   * Announces only the newest character (delta) to avoid re-reading the full buffer.
   * Uses textContent (not appendChild) so VO/NVDA get a simple change event.
   * No auto-clear to give VO time; if needed we can add a small debounce later.
   */
  public announceInput(buffer: string): void {
    if (!this.inputRegion) {
      return;
    }

    const lastLength = this.lastAnnouncedBuffer.length;
    const currentLength = buffer.length;

    if (currentLength > lastLength) {
      const newestChar = buffer[currentLength - 1];
      const normalized = this.normalizeInput(newestChar);

      console.debug('[ScreenReader] Announcing input char:', {
        newestChar,
        normalized,
        lastLength,
        currentLength,
      });

      if (normalized.length === 0) {
        this.lastAnnouncedBuffer = buffer;
        return;
      }

      this.inputRegion.textContent = normalized;
    }

    this.lastAnnouncedBuffer = buffer;
  }

  /**
   * Announces the complete, committed input after user presses Enter.
   * This reads back the entire line so the user can verify what they typed.
   */
  public announceInputCommitted(buffer: string): void {
    if (!this.inputCommittedRegion) {
      return;
    }

    const normalized = this.normalize(buffer);

    console.debug('[ScreenReader] Announcing committed input:', {
      raw: buffer.substring(0, 100),
      normalized: normalized.substring(0, 100),
    });

    if (!normalized) {
      return;
    }

    this.inputCommittedRegion.textContent = `${normalized}`;
    // Reset buffer tracker since we're starting fresh after commit
    this.lastAnnouncedBuffer = '';
  }

  private scheduleClear(): void {
    this.cancelClearTimer();

    this.clearTimer = window.setTimeout(() => {
      this.clear();
    }, this.clearDelayMs);
  }

  private cancelClearTimer(): void {
    if (this.clearTimer !== undefined) {
      window.clearTimeout(this.clearTimer);
      this.clearTimer = undefined;
    }
  }

  // Input clear helpers are retained for potential future use (currently unused)
  private scheduleInputClear(): void {
    this.cancelInputClearTimer();

    this.inputClearTimer = window.setTimeout(() => {
      this.clearInputRegion();
    }, INPUT_CLEAR_DELAY_MS);
  }

  private cancelInputClearTimer(): void {
    if (this.inputClearTimer !== undefined) {
      window.clearTimeout(this.inputClearTimer);
      this.inputClearTimer = undefined;
    }
  }

  private clearInputRegion(): void {
    if (this.inputRegion) {
      this.inputRegion.textContent = '';
    }
  }

  private normalizeInput(raw: string): string {
    if (raw === undefined || raw === null) {
      return '';
    }

    // Do not trim for input to preserve spaces; still strip ANSI/control chars.
    const unifiedNewlines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const withoutAnsi = unifiedNewlines.replace(ANSI_ESCAPE_PATTERN, '');
    const withoutControl = withoutAnsi.replace(CONTROL_CHAR_PATTERN, '');
    return withoutControl;
  }
  private normalize(raw: string): string {
    if (!raw) {
      return '';
    }

    // Convert CRLF/CR to LF to keep announcements concise
    const unifiedNewlines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Strip ANSI escapes and non-printable control chars (except LF)
    const withoutAnsi = unifiedNewlines.replace(ANSI_ESCAPE_PATTERN, '');
    const withoutControl = withoutAnsi.replace(CONTROL_CHAR_PATTERN, '');

    // Collapse excessive blank lines and trim
    const collapsed = withoutControl.replace(/\n{3,}/g, '\n\n');

    return collapsed.trim();
  }
}
