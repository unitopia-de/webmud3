import type { Terminal } from '@xterm/xterm';

import {
  CTRL,
  CSI_REGEX,
  SS3,
  SS3_LEN,
  cursorLeft,
  resetLine,
} from './models/escapes';
import type { MudInputController } from './mud-input.controller';

/**
 * Minimal context required to decide whether the prompt may be hidden/restored.
 */
export type MudPromptContext = {
  isEditMode: boolean;
  terminalReady: boolean;
  localEchoEnabled: boolean;
};

/**
 * Keeps track of prompt / current line state so that we can temporarily hide
 * the local edit buffer while server output is rendered and then restore it.
 * The manager stores visual state (prompt characters already printed by the
 * server) and collaborates with the {@link MudInputController} for user input.
 */
export class MudPromptManager {
  private serverLineBuffer = '';
  private hiddenPrompt = '';
  private leadingLineBreaksToStrip = 0;
  private lineHidden = false;

  /**
   * @param terminal xterm instance that receives redraw commands.
   * @param inputController input controller used to fetch the editable buffer.
   */
  constructor(
    private readonly terminal: Terminal,
    private readonly inputController: MudInputController,
  ) {}

  /**
   * Clears all tracked prompt state.  Typically invoked when the editing mode
   * changes or the terminal is reinitialised.
   */
  public reset(): void {
    this.serverLineBuffer = '';
    this.hiddenPrompt = '';
    this.leadingLineBreaksToStrip = 0;
    this.lineHidden = false;
  }

  /**
   * Strips leading CR/LF characters that belong to a previously hidden prompt so
   * the restored line does not produce blank rows when the server pushes output.
   */
  public transformOutput(data: string): string {
    if (this.leadingLineBreaksToStrip === 0 || data.length === 0) {
      return data;
    }

    let startIndex = 0;
    let remainingBreaks = this.leadingLineBreaksToStrip;

    while (startIndex < data.length && remainingBreaks > 0) {
      const char = data[startIndex];

      if (char === CTRL.LF) {
        remainingBreaks -= 1;
        startIndex += 1;
        continue;
      }

      if (char === CTRL.CR) {
        startIndex += 1;
        continue;
      }

      break;
    }

    this.leadingLineBreaksToStrip = remainingBreaks;

    if (startIndex === 0) {
      this.leadingLineBreaksToStrip = 0;
      return data;
    }

    if (startIndex >= data.length) {
      this.leadingLineBreaksToStrip = 0;
      return '';
    }

    this.leadingLineBreaksToStrip = 0;
    return data.slice(startIndex);
  }

  /**
   * Records the current prompt/input line and clears it from the terminal so
   * that incoming server output appears in the correct position.
   */
  public beforeServerOutput(context: MudPromptContext): void {
    if (
      !context.isEditMode ||
      !context.terminalReady ||
      !context.localEchoEnabled ||
      this.lineHidden
    ) {
      return;
    }

    const hasLineContent =
      this.inputController.hasContent() ||
      this.serverLineBuffer.length > 0 ||
      this.hiddenPrompt.length > 0;

    if (!hasLineContent) {
      return;
    }

    this.hiddenPrompt = this.serverLineBuffer;
    this.serverLineBuffer = '';
    this.leadingLineBreaksToStrip = 1;
    this.terminal.write(resetLine);
    this.lineHidden = true;
  }

  /**
   * Restores a hidden prompt after new server output has been flushed.  The
   * restoration happens asynchronously (next microtask) to ensure the terminal
  * has finished rendering the server chunk first.
   */
  public afterServerOutput(data: string, context: MudPromptContext): void {
    this.trackServerLine(data);

    if (
      !this.lineHidden ||
      !context.isEditMode ||
      !context.terminalReady ||
      !context.localEchoEnabled
    ) {
      return;
    }

    if (
      !this.inputController.hasContent() &&
      this.hiddenPrompt.length === 0 &&
      this.serverLineBuffer.length === 0
    ) {
      return;
    }

    queueMicrotask(() => this.restoreLine(context));
  }

  /**
   * Replays prompt and local input back to the terminal.  Cursor positioning is
   * recalculated from the last input snapshot to maintain the editing position.
   */
  private restoreLine(context: MudPromptContext): void {
    if (!this.lineHidden) {
      return;
    }

    if (
      !context.isEditMode ||
      !context.terminalReady ||
      !context.localEchoEnabled
    ) {
      this.lineHidden = false;
      return;
    }

    const snapshot = this.inputController.getSnapshot();

    this.terminal.write(resetLine);

    const prefix =
      this.serverLineBuffer.length > 0
        ? this.serverLineBuffer
        : this.hiddenPrompt;

    if (prefix.length > 0) {
      this.terminal.write(prefix);
    }

    this.terminal.write(snapshot.buffer);

    const moveLeft = snapshot.buffer.length - snapshot.cursor;

    if (moveLeft > 0) {
      this.terminal.write(cursorLeft(moveLeft));
    }

    this.lineHidden = false;
    this.hiddenPrompt = '';
    this.serverLineBuffer = prefix;
   this.leadingLineBreaksToStrip = 0;
  }

  /**
   * Tracks server-provided characters for the current line so that we can
   * rebuild the prompt later.  Escape sequences are preserved as-is.
   */
  private trackServerLine(chunk: string): void {
    let index = 0;

    while (index < chunk.length) {
      const char = chunk[index];

      if (char === CTRL.CR || char === CTRL.LF) {
        this.serverLineBuffer = '';
        index += 1;
        continue;
      }

      if (char === CTRL.BS || char === CTRL.DEL) {
        this.serverLineBuffer = this.serverLineBuffer.slice(0, -1);
        index += 1;
        continue;
      }

      if (char === CTRL.ESC) {
        const consumed = this.skipEscapeSequence(chunk.slice(index));
        const parsedSequence =
          consumed > 0 ? chunk.slice(index, index + consumed) : char;

        this.serverLineBuffer += parsedSequence;
        index += Math.max(consumed, 1);
        continue;
      }

      this.serverLineBuffer += char;
      index += 1;
    }
  }

  /**
   * @returns number of characters that belong to an escape sequence (CSI/SS3).
   */
  private skipEscapeSequence(segment: string): number {
    if (segment.startsWith(SS3) && segment.length >= SS3_LEN) {
      return SS3_LEN;
    }

    const match = segment.match(CSI_REGEX);

    if (match) {
      return match[0].length;
    }

    return CTRL.ESC.length;
  }
}
