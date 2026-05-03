import type { Terminal } from '@xterm/xterm';

import {
  CTRL,
  CSI_REGEX,
  SS3,
  SS3_LEN,
  backspaceErase,
  cursorLeft,
  cursorRight,
  eraseToEol,
  sequence,
} from './models/escapes';

/** Modifier code embedded in CSI sequences for Alt (xterm convention). */
const MODIFIER_ALT = 3;

/** Maximum number of remembered command history entries. */
const MAX_HISTORY = 200;

/**
 * Callback signature used whenever a buffered line is ready to be sent to the server.
 */
export type MudInputCommitHandler = (payload: {
  message: string;
  echoed: boolean;
}) => void;

/**
 * Callback signature for notifying about input buffer changes.
 * Called whenever the buffer is modified (character inserted, deleted, etc.)
 * but NOT for cursor-only movements.
 */
export type MudInputChangeHandler = (payload: { buffer: string }) => void;

/**
 * Callback signature used when the user presses Tab on a non-empty buffer.
 * The handler is expected to ask the MUD for a completion (e.g. via the
 * `Input.Complete` GMCP request) and later feed the result back into the
 * controller using `replaceBuffer`. Tab itself is not inserted into the buffer.
 */
export type MudInputTabCompleteHandler = (buffer: string) => void;

/**
 * Encapsulates client-side editing state for LINEMODE input.  The controller keeps
 * track of the text buffer and cursor position, applies terminal side-effects
 * when local echo is enabled, and turns user keystrokes into commit events.
 */
export class MudInputController {
  private buffer = '';
  private cursor = 0;
  private lastWasCarriageReturn = false;
  private localEchoEnabled = true;
  // Holds a partially received escape sequence to be completed by the next chunk.
  private pendingEscape = '';

  // Command history: chronological, newest entries appended.
  private readonly history: string[] = [];
  // Position within history while browsing; -1 means "not currently browsing".
  private historyIndex = -1;
  // Buffer the user had typed before they entered history-browse mode; restored
  // when they walk past the most recent entry with Down again.
  private historyAnchor = '';

  /**
   * @param terminal Reference to the xterm instance we mirror the editing state to.
   * @param onCommit Callback that receives a flushed line (with echo information).
   * @param onInputChange Optional callback for input buffer changes (screen reader announcements).
   * @param onTabComplete Optional callback fired when the user presses Tab on
   *   a non-empty buffer. Tab is NOT inserted into the buffer — the handler
   *   typically requests an `Input.Complete` from the MUD and feeds the
   *   answer back via `replaceBuffer`.
   */
  constructor(
    private readonly terminal: Terminal,
    private readonly onCommit: MudInputCommitHandler,
    private readonly onInputChange?: MudInputChangeHandler,
    private readonly onTabComplete?: MudInputTabCompleteHandler,
  ) {}

  /**
   * Processes raw terminal data.  Each character (or escape sequence) updates the
   * internal buffer/cursor state and performs the corresponding terminal writes.
   */
  public handleData(data: string): void {
    // Tab on a non-empty buffer triggers GMCP-driven completion — but only
    // for a genuine single-character keypress, not when Tab arrives as part
    // of a paste. The paste path also routes through handleData; treating
    // each pasted Tab as a completion request would clobber the surrounding
    // text. Detect a stand-alone Tab here and dispatch.
    if (data === CTRL.TAB) {
      if (this.onTabComplete && this.buffer.length > 0) {
        this.onTabComplete(this.buffer);
      }
      return;
    }

    const stream = this.pendingEscape + data;
    this.pendingEscape = '';

    for (let index = 0; index < stream.length; index += 1) {
      const char = stream[index];

      switch (char) {
        case CTRL.CR:
          this.commitBuffer();
          this.lastWasCarriageReturn = true;
          break;
        case CTRL.LF:
          if (!this.lastWasCarriageReturn) {
            this.commitBuffer();
          }

          this.lastWasCarriageReturn = false;
          break;
        case CTRL.BS:
        case CTRL.DEL:
          this.applyBackspace();
          this.lastWasCarriageReturn = false;
          break;
        case CTRL.TAB:
          // Stand-alone Tab is intercepted in the early path above. Any Tab
          // that reaches this branch arrived as part of a longer chunk
          // (paste, multi-char escape rewrite, …) and is silently dropped —
          // pasting a tab-separated value should not commit-via-completion,
          // and a literal Tab in a MUD command line is meaningless.
          this.lastWasCarriageReturn = false;
          break;
        case CTRL.ESC: {
          const consumed = this.handleEscapeSequence(stream.slice(index));

          // Incomplete escape sequence: buffer it and stop processing
          if (consumed === 0) {
            this.pendingEscape = stream.slice(index);
            index = stream.length; // break loop
            break;
          }

          index += consumed - 1;
          this.lastWasCarriageReturn = false;
          break;
        }
        default:
          this.insertCharacter(char);
          this.lastWasCarriageReturn = false;
          break;
      }
    }
  }

  /**
   * Enables or disables local echo.  When disabled we still update the buffer,
   * but no characters are written back to the terminal.
   */
  public setLocalEcho(enabled: boolean): void {
    this.localEchoEnabled = enabled;
  }

  /**
   * Clears all editing state (buffer, cursor, carriage-return tracker).
   */
  public reset(): void {
    this.buffer = '';
    this.cursor = 0;
    this.lastWasCarriageReturn = false;
    this.pendingEscape = '';
  }

  /**
   * @returns `true` when the buffer currently contains user input.
   */
  public hasContent(): boolean {
    return this.buffer.length > 0;
  }

  /**
   * @returns immutable snapshot of buffer + cursor position used for redraws.
   */
  public getSnapshot(): { buffer: string; cursor: number } {
    return { buffer: this.buffer, cursor: this.cursor };
  }

  /**
   * Returns a read-only snapshot of the current command history (oldest first,
   * newest last). Used by the mobile input component which has its own browse
   * state but wants to share the same history source.
   */
  public getHistorySnapshot(): readonly string[] {
    return this.history;
  }

  /**
   * Records `message` in the command history. Uses the same dedup-against-last
   * + max-length policy as committing a line through the controller. Safe to
   * call externally (e.g. from the mobile input path that bypasses the
   * controller's character pipeline).
   */
  public recordHistoryEntry(message: string): void {
    this.pushHistory(message);
  }

  /**
   * Walks one step back through the command history.
   * When `withPrefix` is true, only entries that start with the prefix the
   * user originally typed (the anchor) are considered.
   *
   * Intended for direct invocation from a KeyboardEvent handler when the
   * browser/OS swallows the matching escape sequence before xterm receives
   * it on `onData`.
   */
  public historyBack(withPrefix = false): void {
    this.historyUp(this.resolvePrefix(withPrefix));
  }

  /**
   * Walks one step forward through the command history. See `historyBack`.
   */
  public historyForward(withPrefix = false): void {
    this.historyDown(this.resolvePrefix(withPrefix));
  }

  private resolvePrefix(withPrefix: boolean): string | null {
    if (!withPrefix) {
      return null;
    }

    return this.historyIndex === -1 ? this.buffer : this.historyAnchor;
  }

  /**
   * Replaces the current buffer with `text`, repositions the cursor to the
   * end and — when local echo is enabled — repaints the visible line.
   *
   * Intended for use after the MUD answers an `Input.Complete` request with
   * `Input.CompleteText`: the server returns the fully-completed command line
   * which we drop in verbatim. If echo is off (e.g. password entry) the
   * buffer is still replaced, but no terminal output is produced — the
   * MUD's own echo will surface the completion if appropriate.
   */
  public replaceBuffer(text: string): void {
    this.exitHistoryBrowse();

    const previousCursor = this.cursor;

    this.buffer = text;
    this.cursor = text.length;

    this.onInputChange?.({ buffer: this.buffer });

    if (!this.localEchoEnabled) {
      return;
    }

    // Move cursor back to the start of the previous buffer, erase to the
    // end of the line, then write the new contents. The buffer always sits
    // at the end of the line so eraseToEol is sufficient — no need to track
    // the previous length.
    if (previousCursor > 0) {
      this.terminal.write(cursorLeft(previousCursor));
    }
    this.terminal.write(eraseToEol);
    if (text.length > 0) {
      this.terminal.write(text);
    }
  }

  /**
   * Flushes the buffer and resets the controller.  When nothing has been typed
   * the call is a no-op and `null` is returned.
   */
  public flush(): { message: string; echoed: boolean } | null {
    if (!this.hasContent()) {
      this.lastWasCarriageReturn = false;
      return null;
    }

    const payload = {
      message: this.buffer,
      echoed: this.localEchoEnabled,
    };

    this.reset();

    return payload;
  }

  /**
   * Commits the current buffer to the consumer and resets editing state.  Local
   * echo is honoured by writing CRLF before the callback is fired.
   *
   * Only echoed input lands in the command history. Lines entered while the
   * server has disabled local echo (passwords, login tokens, ...) are
   * intentionally never recorded.
   */
  private commitBuffer(): void {
    const message = this.buffer;

    if (this.localEchoEnabled) {
      this.pushHistory(message);
    }

    this.reset();

    if (this.localEchoEnabled) {
      this.terminal.write(sequence(CTRL.CR, CTRL.LF));
    }

    this.onCommit({ message, echoed: this.localEchoEnabled });
  }

  /**
   * Appends `message` to the command history, deduplicating against the
   * previous entry and capping at MAX_HISTORY. Empty messages are ignored.
   */
  private pushHistory(message: string): void {
    if (message === '') {
      return;
    }

    if (
      this.history.length > 0 &&
      this.history[this.history.length - 1] === message
    ) {
      return;
    }

    this.history.push(message);

    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }
  }

  /**
   * Inserts a printable character at the current cursor position and, when echo
   * is enabled, rewrites the tail of the line and moves the cursor back.
   */
  private insertCharacter(char: string): void {
    const charCode = char.charCodeAt(0);

    if (charCode < 32) {
      return;
    }

    this.exitHistoryBrowse();

    const before = this.buffer.slice(0, this.cursor);
    const after = this.buffer.slice(this.cursor);

    this.buffer = before + char + after;
    this.cursor += 1;

    this.onInputChange?.({
      buffer: this.buffer,
    });

    if (!this.localEchoEnabled) {
      return;
    }

    this.terminal.write(sequence(char, after));

    if (after.length > 0) {
      this.terminal.write(cursorLeft(after.length));
    }
  }

  /**
   * Removes a character left of the cursor and reflows the remaining suffix so
   * that the terminal visually matches the updated buffer.
   */
  private applyBackspace(): void {
    if (this.cursor === 0) {
      return;
    }

    this.exitHistoryBrowse();

    const before = this.buffer.slice(0, this.cursor - 1);
    const after = this.buffer.slice(this.cursor);

    this.buffer = before + after;
    this.cursor -= 1;

    this.onInputChange?.({
      buffer: this.buffer,
    });

    if (!this.localEchoEnabled) {
      return;
    }

    if (after.length > 0) {
      this.terminal.write(sequence(CTRL.BS, after, ' '));
      this.terminal.write(cursorLeft(after.length + 1));
    } else {
      this.terminal.write(backspaceErase);
    }
  }

  /**
   * Moves the logical cursor to the left and emits the matching terminal escape.
   */
  private moveCursorLeft(amount: number): void {
    if (amount <= 0) {
      return;
    }

    const target = Math.max(0, this.cursor - amount);
    const delta = this.cursor - target;

    if (delta === 0) {
      return;
    }

    this.cursor = target;

    if (this.localEchoEnabled) {
      this.terminal.write(cursorLeft(delta));
    }
  }

  /**
   * Moves the logical cursor to the right and emits the matching terminal escape.
   */
  private moveCursorRight(amount: number): void {
    if (amount <= 0) {
      return;
    }

    const target = Math.min(this.buffer.length, this.cursor + amount);
    const delta = target - this.cursor;

    if (delta === 0) {
      return;
    }

    this.cursor = target;

    if (this.localEchoEnabled) {
      this.terminal.write(cursorRight(delta));
    }
  }

  /**
   * Parses an escape sequence (CSI or SS3) emitted by the terminal for arrow keys.
   * Cursor keys are translated into logical cursor movements.
   *
   * @returns number of characters consumed from the segment.
   */
  private handleEscapeSequence(segment: string): number {
    // xterm encodes Alt+key in two ways depending on options:
    //   1) modifier-in-CSI:  ESC [ 1;3 A   (handled in the regular CSI path)
    //   2) meta-sends-ESC:   ESC ESC [ A   (the leading ESC is the Alt prefix)
    // Detect the second form here and dispatch to the history with a stable
    // prefix (anchor while browsing, current buffer otherwise).
    if (segment.length >= 2 && segment[1] === CTRL.ESC) {
      if (segment.length < 3) {
        return 0; // need more bytes to know what follows
      }

      if (segment[2] !== '[') {
        // Alt + something we don't care about: drop just the leading ESC and
        // let the next iteration handle the rest.
        return CTRL.ESC.length;
      }

      const inner = segment.slice(CTRL.ESC.length);
      const innerMatch = inner.match(CSI_REGEX);

      if (!innerMatch) {
        return 0; // incomplete CSI after the Alt prefix
      }

      const innerToken = innerMatch[0];
      const finalChar = innerToken[innerToken.length - 1];
      const consumed = CTRL.ESC.length + innerToken.length;

      if (finalChar === 'A' || finalChar === 'B') {
        const prefix =
          this.historyIndex === -1 ? this.buffer : this.historyAnchor;

        if (finalChar === 'A') {
          this.historyUp(prefix);
        } else {
          this.historyDown(prefix);
        }
      }

      return consumed;
    }

    if (segment.startsWith(SS3)) {
      if (segment.length < SS3_LEN) {
        return 0; // incomplete SS3
      }

      const control = segment[2];

      switch (control) {
        case 'A':
          this.historyUp(null);
          break;
        case 'B':
          this.historyDown(null);
          break;
        case 'C':
          this.moveCursorRight(1);
          break;
        case 'D':
          this.moveCursorLeft(1);
          break;
        case 'H':
          this.moveCursorToStart();
          break;
        case 'F':
          this.moveCursorToEnd();
          break;
        default:
          break;
      }

      return SS3_LEN;
    }

    const match = segment.match(CSI_REGEX);

    if (!match) {
      // Incomplete CSI (ESC [ ... without terminator)
      if (segment.startsWith(CTRL.ESC + '[')) {
        return 0;
      }

      // Unknown sequence: consume ESC to avoid locking up
      return CTRL.ESC.length;
    }

    const token = match[0];
    const finalChar = token[token.length - 1];
    const params = token.slice(2, -1);
    const parts = params.length === 0 ? [] : params.split(';');
    const amount = parts.length === 0 ? 1 : Number.parseInt(parts[0], 10) || 1;
    const modifier = parts.length > 1 ? Number.parseInt(parts[1], 10) || 1 : 1;

    switch (finalChar) {
      case 'A': {
        // Alt+Up filters by the originally typed prefix. The first press uses
        // the current buffer (which then becomes the anchor); subsequent
        // presses keep using the anchor so the prefix is stable while browsing.
        const prefix =
          modifier === MODIFIER_ALT
            ? this.historyIndex === -1
              ? this.buffer
              : this.historyAnchor
            : null;
        this.historyUp(prefix);
        break;
      }
      case 'B': {
        const prefix =
          modifier === MODIFIER_ALT
            ? this.historyIndex === -1
              ? this.buffer
              : this.historyAnchor
            : null;
        this.historyDown(prefix);
        break;
      }
      case 'C':
        this.moveCursorRight(amount);
        break;
      case 'D':
        this.moveCursorLeft(amount);
        break;
      case 'H':
        this.moveCursorToStart();
        break;
      case 'F':
        this.moveCursorToEnd();
        break;
      case '~':
        switch (amount) {
          case 1:
          case 7:
            this.moveCursorToStart();
            break;
          case 4:
          case 8:
            this.moveCursorToEnd();
            break;
          case 3:
            this.applyDelete();
            break;
          default:
            break;
        }
        break;
      default:
        break;
    }

    return token.length;
  }

  /**
   * Removes the character at the cursor position without moving the cursor.
   * The suffix is reflowed to keep the terminal in sync with the buffer.
   */
  private applyDelete(): void {
    if (this.cursor >= this.buffer.length) {
      return;
    }

    this.exitHistoryBrowse();

    const before = this.buffer.slice(0, this.cursor);
    const after = this.buffer.slice(this.cursor + 1);

    this.buffer = before + after;

    this.onInputChange?.({
      buffer: this.buffer,
    });

    if (!this.localEchoEnabled) {
      return;
    }

    if (after.length > 0) {
      this.terminal.write(sequence(after, ' '));
      this.terminal.write(cursorLeft(after.length + 1));
    } else {
      this.terminal.write(' ');
      this.terminal.write(cursorLeft(1));
    }
  }

  private moveCursorToStart(): void {
    this.moveCursorLeft(this.cursor);
  }

  private moveCursorToEnd(): void {
    this.moveCursorRight(this.buffer.length - this.cursor);
  }

  // ---------------------------------------------------------------------------
  // Command history
  // ---------------------------------------------------------------------------

  /**
   * Walks one step back in the command history. When `prefix` is non-null,
   * only entries that start with the prefix are considered. The first call
   * also stashes the current buffer in `historyAnchor` so a later Down past
   * the newest match can restore it.
   */
  private historyUp(prefix: string | null): void {
    if (this.history.length === 0) {
      return;
    }

    if (this.historyIndex === -1) {
      this.historyAnchor = this.buffer;
      this.historyIndex = this.history.length;
    }

    for (let i = this.historyIndex - 1; i >= 0; i -= 1) {
      const entry = this.history[i];

      if (prefix === null || entry.startsWith(prefix)) {
        this.historyIndex = i;
        this.replaceBufferTextually(entry);
        return;
      }
    }
    // No match found; stay where we are so the next Down resumes correctly.
  }

  /**
   * Walks one step forward in the command history. Stepping past the newest
   * matching entry restores the originally typed buffer (the anchor) and
   * leaves browse mode.
   */
  private historyDown(prefix: string | null): void {
    if (this.historyIndex === -1) {
      return;
    }

    for (let i = this.historyIndex + 1; i < this.history.length; i += 1) {
      const entry = this.history[i];

      if (prefix === null || entry.startsWith(prefix)) {
        this.historyIndex = i;
        this.replaceBufferTextually(entry);
        return;
      }
    }

    // No more matches: restore the anchor and exit browse mode.
    const anchor = this.historyAnchor;
    this.historyIndex = -1;
    this.historyAnchor = '';
    this.replaceBufferTextually(anchor);
  }

  /**
   * Marks the user as no longer browsing history without touching the buffer.
   * Called whenever the user actively edits (insert / backspace / delete) so
   * subsequent edits behave normally.
   */
  private exitHistoryBrowse(): void {
    if (this.historyIndex === -1) {
      return;
    }

    this.historyIndex = -1;
    this.historyAnchor = '';
  }

  /**
   * Replaces the buffer with `newText` and mirrors the change to the terminal:
   * cursor is moved back to the buffer's start, the rest of the line is erased
   * (which leaves any prompt to the left untouched), then the new text is
   * written. Cursor lands at the end of the new buffer.
   */
  private replaceBufferTextually(newText: string): void {
    if (this.localEchoEnabled) {
      if (this.cursor > 0) {
        this.terminal.write(cursorLeft(this.cursor));
      }

      this.terminal.write(eraseToEol);
      this.terminal.write(newText);
    }

    this.buffer = newText;
    this.cursor = newText.length;

    this.onInputChange?.({ buffer: this.buffer });
  }
}
