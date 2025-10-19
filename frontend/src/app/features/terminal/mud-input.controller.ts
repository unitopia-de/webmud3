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

export type MudInputCommitHandler = (payload: {
  message: string;
  echoed: boolean;
}) => void;

/**
 * Encapsulates client-side editing state for LINEMODE input.
 * Keeps track of the text buffer, cursor position and terminal echo updates.
 */
export class MudInputController {
  private buffer = '';
  private cursor = 0;
  private lastWasCarriageReturn = false;
  private localEchoEnabled = true;

  constructor(
    private readonly terminal: Terminal,
    private readonly onCommit: MudInputCommitHandler,
  ) {}

  public handleData(data: string): void {
    for (let index = 0; index < data.length; index += 1) {
      const char = data[index];

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
          const consumed = this.handleEscapeSequence(data.slice(index));
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

  public setLocalEcho(enabled: boolean): void {
    this.localEchoEnabled = enabled;
  }

  public reset(): void {
    this.buffer = '';
    this.cursor = 0;
    this.lastWasCarriageReturn = false;
  }

  public hasContent(): boolean {
    return this.buffer.length > 0;
  }

  public getSnapshot(): { buffer: string; cursor: number } {
    return { buffer: this.buffer, cursor: this.cursor };
  }

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

  private commitBuffer(): void {
    const message = this.buffer;

    this.reset();

    if (this.localEchoEnabled) {
      this.terminal.write(sequence(CTRL.CR, CTRL.LF));
    }

    this.onCommit({ message, echoed: this.localEchoEnabled });
  }

  private insertCharacter(char: string): void {
    const charCode = char.charCodeAt(0);

    if (charCode < 32 && char !== CTRL.TAB) {
      return;
    }

    const before = this.buffer.slice(0, this.cursor);
    const after = this.buffer.slice(this.cursor);

    this.buffer = before + char + after;
    this.cursor += 1;

    if (!this.localEchoEnabled) {
      return;
    }

    this.terminal.write(sequence(char, after));

    if (after.length > 0) {
      this.terminal.write(cursorLeft(after.length));
    }
  }

  private applyBackspace(): void {
    if (this.cursor === 0) {
      return;
    }

    const before = this.buffer.slice(0, this.cursor - 1);
    const after = this.buffer.slice(this.cursor);

    this.buffer = before + after;
    this.cursor -= 1;

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

  private handleEscapeSequence(segment: string): number {
    if (segment.startsWith(SS3) && segment.length >= SS3_LEN) {
      const control = segment[2];

      switch (control) {
        case 'C':
          this.moveCursorRight(1);
          break;
        case 'D':
          this.moveCursorLeft(1);
          break;
        default:
          break;
      }

      return SS3_LEN;
    }

    const match = segment.match(CSI_REGEX);

    if (!match) {
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
      default:
        break;
    }

    return token.length;
  }
}
