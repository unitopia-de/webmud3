import type { Terminal } from '@xterm/xterm';

import {
  CTRL,
  CSI_REGEX,
  SS3,
  SS3_LEN,
  backspaceErase,
  cursorLeft,
  cursorRight,
  sequence,
} from './models/escapes';

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

  /**
   * @param terminal Reference to the xterm instance we mirror the editing state to.
   * @param onCommit Callback that receives a flushed line (with echo information).
   * @param onInputChange Optional callback for input buffer changes (screen reader announcements).
   */
  constructor(
    private readonly terminal: Terminal,
    private readonly onCommit: MudInputCommitHandler,
    private readonly onInputChange?: MudInputChangeHandler,
  ) {}

  /**
   * Processes raw terminal data.  Each character (or escape sequence) updates the
   * internal buffer/cursor state and performs the corresponding terminal writes.
   */
  public handleData(data: string): void {
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
   */
  private commitBuffer(): void {
    const message = this.buffer;

    this.reset();

    if (this.localEchoEnabled) {
      this.terminal.write(sequence(CTRL.CR, CTRL.LF));
    }

    this.onCommit({ message, echoed: this.localEchoEnabled });
  }

  /**
   * Inserts a printable character at the current cursor position and, when echo
   * is enabled, rewrites the tail of the line and moves the cursor back.
   */
  private insertCharacter(char: string): void {
    const charCode = char.charCodeAt(0);

    if (charCode < 32 && char !== CTRL.TAB) {
      return;
    }

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
    if (segment.startsWith(SS3)) {
      if (segment.length < SS3_LEN) {
        return 0; // incomplete SS3
      }

      const control = segment[2];

      switch (control) {
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
    const amount =
      params.length === 0 ? 1 : Number.parseInt(params.split(';')[0], 10) || 1;

    switch (finalChar) {
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
}
