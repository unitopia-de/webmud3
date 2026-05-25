const LIVE_CLEAR_DELAY_MS = 2000;
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
  private liveClearTimer: number | undefined;
  private sessionStartedAt: number;

  constructor(
    private readonly liveRegion: HTMLElement,
    private readonly historyRegion?: HTMLElement,
    private readonly isLoggingEnabled: () => boolean = () => false,
  ) {
    this.sessionStartedAt = Date.now();
  }

  /** Internal: emits debug logs only when the runtime flag is enabled. */
  private log(...args: unknown[]): void {
    if (this.isLoggingEnabled()) {
      console.debug(...args);
    }
  }

  /**
   * Marks the current connection session start and clears any pending output.
   */
  public markSessionStart(timestamp: number = Date.now()): void {
    this.sessionStartedAt = timestamp;
    this.stopAnnouncements();
    this.clearHistory();
  }

  /**
   * Announces sanitized output to the aria-live region when it is newer than the current session.
   */
  public announce(raw: string, receivedAt: number = Date.now()): void {
    if (receivedAt < this.sessionStartedAt) {
      this.log(
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

    this.log('[ScreenReader] Announcing:', {
      raw: raw.substring(0, 100),
      normalized: normalized.substring(0, 100),
    });

    if (!normalized) {
      this.log('[ScreenReader] Skipped empty normalized output');
      return;
    }

    this.appendToLiveRegion(normalized);
  }

  /**
   * Clears the live region and any pending timers.
   */
  public clear(): void {
    this.liveRegion.textContent = '';
  }

  /**
   * Stops any in-flight announcements and drops the queued backlog.
   */
  public stopAnnouncements(): void {
    this.cancelLiveClearTimer();
    this.clear();
  }

  /**
   * Disposes internal timers.
   */
  public dispose(): void {
    this.stopAnnouncements();
    this.cancelLiveClearTimer();
  }

  /**
   * Appends sanitized text to the history region so users can navigate it later.
   * Splits text by newlines to create separate entries for each line, allowing screen readers
   * to announce each line individually rather than reading the entire block as one.
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
    const lines = normalized.split('\n');

    for (const line of lines) {
      // Skip empty lines to avoid cluttering the history
      if (!line.trim()) {
        continue;
      }

      const item = doc.createElement('p');
      item.className = 'sr-log-item';
      item.textContent = line;
      item.setAttribute('role', 'text');

      this.historyRegion.appendChild(item);
    }
  }

  /**
   * Clears the history region entirely (e.g., on reconnect).
   */
  public clearHistory(): void {
    if (this.historyRegion) {
      this.historyRegion.textContent = '';
    }
  }

  private appendToLiveRegion(normalized: string): void {
    const doc = this.liveRegion.ownerDocument;
    this.liveRegion.appendChild(doc.createTextNode(`${normalized}\n`));
    this.scheduleLiveClear();
  }

  private scheduleLiveClear(): void {
    this.cancelLiveClearTimer();
    this.liveClearTimer = window.setTimeout(() => {
      this.liveRegion.textContent = '';
    }, LIVE_CLEAR_DELAY_MS);
  }

  private cancelLiveClearTimer(): void {
    if (this.liveClearTimer !== undefined) {
      window.clearTimeout(this.liveClearTimer);
      this.liveClearTimer = undefined;
    }
  }

  public normalizeForComparison(raw: string): string {
    return this.normalize(raw);
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
