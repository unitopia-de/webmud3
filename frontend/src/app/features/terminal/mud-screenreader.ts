const INPUT_CLEAR_DELAY_MS = 700;
const ANSI_ESCAPE_PATTERN = /\x1B\[[0-9;?]*[ -\/]*[@-~]/g;
const CONTROL_CHAR_PATTERN = /[\x00-\x08\x0B-\x1F\x7F]/g;
/**
 * Upper bound on the number of <p> line nodes kept in the history region.
 * The region is appended to on every output chunk and is a fully laid-out
 * (transparent, position:absolute, full-size) element, so an unbounded node
 * count made the whole app stall once the output reached ~100 pages
 * (thousands of nodes re-flowed on every style/layout pass). When the cap is
 * exceeded the oldest lines are dropped — recent history is what AT users
 * navigate, and the bound matches the spirit of a finite scrollback.
 */
const MAX_HISTORY_ITEMS = 2000;
/**
 * Upper bound on the number of text nodes kept in the live (announce) region.
 * Like the history region this grows by one node per output chunk and is
 * never cleared mid-session (clearing breaks NVDA/JAWS — see
 * {@link MudScreenReaderAnnouncer.appendToLiveRegion}). Unlike the history
 * region it is only a short read-ahead buffer for the screen reader, not a
 * navigable transcript, so a much smaller bound suffices. Trimming the OLDEST
 * nodes is safe: with `aria-relevant="additions text"` removals are not
 * announced, and nodes this far back were spoken long ago.
 */
const MAX_LIVE_ITEMS = 500;
/**
 * "Quiet output" caps and coalescing window, used when the EZ-Shell's quiet
 * mode is on. iOS VoiceOver chokes on the default high mutation rate + large
 * DOM, so we drop the caps hard and coalesce announcements into one node per
 * window instead of one per chunk/line. See {@link QuietOutputService}.
 */
const QUIET_MAX_HISTORY_ITEMS = 400;
const QUIET_COALESCE_MS = 200;

/**
 * Minimal screenreader announcer tailored for xterm output.
 *
 * Responsibilities:
 * - Announce only new chunks (based on session start timestamp)
 * - Normalize data by stripping control / ANSI sequences
 * - Clear the live region shortly after announcing to avoid re-reading history
 * - Announce typed input word-by-word (on whitespace) and as a full line on commit
 */
export class MudScreenReaderAnnouncer {
  private inputClearTimer: number | undefined;
  private sessionStartedAt: number;
  private lastAnnouncedBuffer = '';
  // Quiet-mode coalescing buffer for the live region (see appendToLiveRegion).
  private liveCoalesceBuffer = '';
  private liveCoalesceTimer: number | undefined;

  constructor(
    private readonly liveRegion: HTMLElement,
    private readonly historyRegion?: HTMLElement,
    private readonly isLoggingEnabled: () => boolean = () => false,
    private readonly inputRegion?: HTMLElement,
    // When this returns true, announcements are coalesced and the DOM caps are
    // dropped hard — tuned for iOS VoiceOver. Default off keeps the validated
    // NVDA/JAWS behaviour.
    private readonly isQuietMode: () => boolean = () => false,
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
    this.lastAnnouncedBuffer = '';
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
    this.cancelLiveCoalesce();
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

    this.trimHistory();
  }

  /**
   * Drops the oldest line nodes once the history region exceeds
   * {@link MAX_HISTORY_ITEMS}, keeping the DOM (and its layout cost) bounded
   * no matter how much output a session produces.
   */
  private trimHistory(): void {
    if (!this.historyRegion) {
      return;
    }
    const cap = this.isQuietMode()
      ? QUIET_MAX_HISTORY_ITEMS
      : MAX_HISTORY_ITEMS;
    while (this.historyRegion.childElementCount > cap) {
      this.historyRegion.removeChild(this.historyRegion.firstElementChild!);
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

      this.log('[ScreenReader] Input changed:', {
        newestChar,
        lastLength,
        currentLength,
      });

      // (b) Check if we just completed a word (whitespace as delimiter)
      if (/\s/.test(newestChar)) {
        const lastWord = this.extractLastWord(buffer);
        const normalizedWord = lastWord ? this.normalizeInput(lastWord) : '';

        this.log('[ScreenReader] Word boundary detected:', {
          lastWord,
          normalizedWord,
        });

        // Announce the word (or fallback to the whitespace token if empty)
        this.inputRegion.textContent =
          normalizedWord || this.describeChar(newestChar);
      }
    } else if (currentLength < lastLength) {
      // Backspace/delete: silently track, textarea is read by SR automatically
      this.log('[ScreenReader] Buffer shortened (backspace/delete):', {
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
   * (c) Announces the committed input after user presses Enter.
   *
   * Reads back ONLY the last word of the line — the one that sits after
   * the final whitespace. All earlier words have already been spoken by
   * `announceInput` when the user typed their trailing whitespace, so
   * re-reading the whole line on Enter would echo everything twice. The
   * last word never gets a per-word boundary trigger, so this is the only
   * chance to surface it before the server response arrives.
   *
   * For single-word commands (no whitespace), the "last word" equals the
   * whole input, so the command is still confirmed in full.
   */
  public announceInputCommitted(buffer: string): void {
    if (!this.inputRegion) {
      return;
    }

    const tailWord = this.extractTailWord(buffer);
    const normalized = tailWord ? this.normalize(tailWord) : '';

    this.log('[ScreenReader] Announcing committed input (tail word):', {
      raw: buffer.substring(0, 100),
      tail: normalized.substring(0, 100),
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

  /**
   * Returns the substring after the last whitespace in `buffer`. If the
   * buffer has no whitespace, returns the whole buffer. Trailing whitespace
   * is treated as "no tail word" (the previous word was already announced
   * when the whitespace was typed).
   */
  private extractTailWord(buffer: string): string {
    if (!buffer) return '';
    // Trailing whitespace → no unsaid word; announceInput already covered it.
    if (/\s$/.test(buffer)) return '';
    const match = /\S+$/.exec(buffer);
    return match ? match[0] : '';
  }

  /**
   * Appends sanitized text to the live region. Does NOT auto-clear the region
   * afterwards — clearing within ~2s breaks NVDA/JAWS on Windows (the screen
   * reader picks up the change but the content is gone before it reads it,
   * resulting in silence). The region is drained on `markSessionStart` /
   * `stopAnnouncements` instead; growing content within a session is fine
   * because `aria-relevant="additions text"` makes the SR speak only the
   * delta, not the accumulated history.
   */
  private appendToLiveRegion(normalized: string): void {
    if (!this.isQuietMode()) {
      // Default (NVDA/JAWS): append immediately, one node per chunk.
      const doc = this.liveRegion.ownerDocument;
      this.liveRegion.appendChild(doc.createTextNode(`${normalized}\n`));
      this.trimLiveRegion();
      return;
    }

    // Quiet mode (iOS VoiceOver): coalesce rapid output into ONE node per
    // window so VoiceOver isn't flooded with a mutation per chunk/line.
    this.liveCoalesceBuffer += `${normalized}\n`;
    if (this.liveCoalesceTimer === undefined) {
      this.liveCoalesceTimer = window.setTimeout(
        () => this.flushLiveCoalesce(),
        QUIET_COALESCE_MS,
      );
    }
  }

  /**
   * Flushes the coalesced quiet-mode buffer by REPLACING the live region with
   * the new block (a single text node), rather than appending + trimming.
   *
   * iOS VoiceOver re-reads a live region whenever its existing nodes are
   * mutated — so trimming the oldest node on each flush made VoiceOver
   * re-announce remaining content (the "repeated output" the tester heard).
   * A clean replace announces the new block exactly once and keeps the region
   * at a single node, which is the canonical VoiceOver live-region pattern.
   */
  private flushLiveCoalesce(): void {
    this.liveCoalesceTimer = undefined;
    const text = this.liveCoalesceBuffer;
    this.liveCoalesceBuffer = '';
    if (!text) {
      return;
    }
    this.liveRegion.textContent = text;
  }

  /** Cancels a pending coalesce flush and drops its buffered text. */
  private cancelLiveCoalesce(): void {
    if (this.liveCoalesceTimer !== undefined) {
      window.clearTimeout(this.liveCoalesceTimer);
      this.liveCoalesceTimer = undefined;
    }
    this.liveCoalesceBuffer = '';
  }

  /**
   * Drops the oldest text nodes once the live region exceeds {@link
   * MAX_LIVE_ITEMS}. Only used by the default (append) path — quiet mode
   * replaces the region instead (see flushLiveCoalesce). Only nodes far behind
   * the read head are removed, so the screen reader never loses text it is
   * about to speak.
   */
  private trimLiveRegion(): void {
    while (this.liveRegion.childNodes.length > MAX_LIVE_ITEMS) {
      this.liveRegion.removeChild(this.liveRegion.firstChild!);
    }
  }

  public normalizeForComparison(raw: string): string {
    return this.normalize(raw);
  }

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
