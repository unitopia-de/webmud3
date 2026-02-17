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
  private inputClearTimer: number | undefined;
  private sessionStartedAt: number;
  private lastAnnouncedBuffer = '';

  constructor(
    private readonly liveRegion: HTMLElement,
    private readonly historyRegion?: HTMLElement,
    private readonly inputRegion?: HTMLElement,
  ) {
    this.sessionStartedAt = Date.now();
  }

  /**
   * Marks the current connection session start and clears any pending output.
   */
  public markSessionStart(timestamp: number = Date.now()): void {
    this.sessionStartedAt = timestamp;
    this.stopAnnouncements();
    this.clearHistory();
    this.lastAnnouncedBuffer = '';
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
    this.clear();
  }

  /**
   * Disposes internal timers.
   */
  public dispose(): void {
    this.stopAnnouncements();
    this.cancelInputClearTimer();
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

  /**
   * Announces input changes with three levels:
   * (a) Per-character: textarea is read automatically by SR; no manual announcement
   * (b) Per-word: when whitespace is encountered, announce the complete word
   * (c) On commit: full line is announced via announceInputCommitted()
   *
   * Note: Per-character feedback is handled by the helper textarea being read
   * by the screen reader automatically, so we skip manual textContent updates
   * for individual chars to avoid double announcements.
   */
  public announceInput(buffer: string): void {
    if (!this.inputRegion) {
      return;
    }

    const lastLength = this.lastAnnouncedBuffer.length;
    const currentLength = buffer.length;

    if (currentLength > lastLength) {
      const newestChar = buffer[currentLength - 1];

      console.debug('[ScreenReader] Input changed:', {
        newestChar,
        lastLength,
        currentLength,
      });

      // (b) Check if we just completed a word (whitespace as delimiter)
      if (/\s/.test(newestChar)) {
        const lastWord = this.extractLastWord(buffer);
        const normalizedWord = lastWord ? this.normalizeInput(lastWord) : '';

        console.debug('[ScreenReader] Word boundary detected:', {
          lastWord,
          normalizedWord,
        });

        // Announce the word (or fallback to the whitespace token if empty)
        this.inputRegion.textContent =
          normalizedWord || this.describeChar(newestChar);
      }
    } else if (currentLength < lastLength) {
      // Backspace/delete: silently track, textarea is read by SR automatically
      console.debug('[ScreenReader] Buffer shortened (backspace/delete):', {
        lastLength,
        currentLength,
      });
    }

    this.lastAnnouncedBuffer = buffer;
  }

  /**
   * Extracts the last word from the buffer (text before the last whitespace).
   * Used for per-word announcements when user types a space.
   */
  private extractLastWord(buffer: string): string {
    if (!buffer) return '';

    // Find the last whitespace (remove trailing whitespace)
    const trimmedFromRight = buffer.replace(/\s+$/, '');
    if (trimmedFromRight === buffer) {
      // No trailing whitespace, return empty
      return '';
    }

    // Find position of last word (before trailing whitespace)
    let lastNonWhitespace = -1;
    for (let i = trimmedFromRight.length - 1; i >= 0; i--) {
      if (/\S/.test(trimmedFromRight[i])) {
        lastNonWhitespace = i;
        break;
      }
    }

    if (lastNonWhitespace === -1) {
      return '';
    }

    // Find the start of the last word (after previous whitespace)
    let wordStart = 0;
    for (let i = lastNonWhitespace; i >= 0; i--) {
      if (/\s/.test(trimmedFromRight[i])) {
        wordStart = i + 1;
        break;
      }
    }

    return trimmedFromRight.slice(wordStart, lastNonWhitespace + 1);
  }

  /**
   * Maps characters to speakable tokens for screen readers.
   */
  private describeChar(char: string): string {
    if (char === ' ') {
      return 'Leerzeichen';
    }

    if (char === '\n') {
      return 'Zeilenumbruch';
    }

    if (char === '\t') {
      return 'Tab';
    }

    const normalized = this.normalizeInput(char);
    return normalized || '';
  }

  /**
   * (c) Announces the complete, committed input after user presses Enter.
   * Reads back the entire line so the user can verify what they typed.
   * Auto-clears after a delay to reset for the next input line.
   */
  public announceInputCommitted(buffer: string): void {
    if (!this.inputRegion) {
      return;
    }

    const normalized = this.normalize(buffer);

    console.debug('[ScreenReader] Announcing committed input:', {
      raw: buffer.substring(0, 100),
      normalized: normalized.substring(0, 100),
    });

    if (!normalized) {
      this.lastAnnouncedBuffer = '';
      return;
    }

    this.inputRegion.textContent = normalized;

    // Auto-clear after delay so user gets confirmation but next input starts fresh
    this.scheduleInputClear();

    // Reset buffer tracker since we're starting fresh after commit
    this.lastAnnouncedBuffer = '';
  }

  private appendToLiveRegion(normalized: string): void {
    const doc = this.liveRegion.ownerDocument;
    this.liveRegion.appendChild(doc.createTextNode(`${normalized}\n`));
  }

  public normalizeForComparison(raw: string): string {
    return this.normalize(raw);
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
