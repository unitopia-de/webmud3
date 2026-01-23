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
 * Manages the visibility cycle of the user's input line during server output.
 *
 * ## Problem
 * When the server sends output while the user is typing, we must prevent the
 * server text from interleaving with the local input buffer. This manager
 * temporarily hides the current line, lets the server output render, then
 * restores the prompt and user input.
 *
 * ## State Machine
 * ```
 * ┌─────────┐  beforeServerOutput()  ┌────────┐
 * │ VISIBLE │ ────────────────────>  │ HIDDEN │
 * │         │                        │        │
 * │ User is │                        │ Server │
 * │ typing  │                        │ writes │
 * │         │ <───────────────────-  │        │
 * └─────────┘   restoreLine()        └────────┘
 *               (async via queueMicrotask)
 * ```
 *
 * ## State Variables
 * - **currentPrompt**: The prompt characters accumulated from server output
 *   (e.g., "> " or "HP:100> "). Reset on CR/LF. Preserved across hide/restore.
 *   Example progression: "" → ">" → "> " (as server sends chars)
 *
 * - **stripNextLineBreak**: Boolean flag indicating we should remove leading
 *   CRLF from the next server chunk to prevent blank lines after restore.
 *   Set to true in beforeServerOutput(), consumed in transformOutput().
 *
 * - **incompleteEscape**: Buffer holding partial ANSI escape sequence from
 *   previous chunk (e.g., if chunk ends with "\x1b["). Combined with next
 *   chunk to parse complete sequence.
 *
 * - **lineHidden**: Boolean guard preventing double hide/restore operations.
 *   Set to true in beforeServerOutput(), false in restoreLine().
 *
 * @example
 * // Scenario: User types "say hello" while server sends combat message
 * // 1. User buffer: "say hello", cursor at position 9
 * // 2. Server about to send: "\r\nGoblin attacks!\r\n> "
 * // 3. beforeServerOutput(): Hide line, set stripNextLineBreak=true
 * // 4. transformOutput(): Strip leading "\r\n", return "Goblin attacks!\r\n> "
 * // 5. trackServerLine(): Accumulate "> " into currentPrompt
 * // 6. afterServerOutput(): Schedule restore
 * // 7. restoreLine(): Write "> say hello", cursor at 9
 */
export class MudPromptManager {
  /** Current prompt accumulated from server output (e.g., "> " or "HP:100> ") */
  private currentPrompt = '';

  /** Flag to strip next CRLF sequence to prevent blank line after restore */
  private stripNextLineBreak = false;

  /** Buffer for incomplete escape sequence at chunk boundary */
  private incompleteEscape = '';

  /** Guard flag: true when line is hidden, false when visible */
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
   * Clears all tracked prompt state.
   *
   * **When to call:**
   * - LINEMODE changes (edit ↔ character mode)
   * - Terminal is reinitialized
   * - Connection is reset
   *
   * **Postcondition:** All state variables are reset to initial values.
   */
  public reset(): void {
    this.currentPrompt = '';
    this.stripNextLineBreak = false;
    this.incompleteEscape = '';
    this.lineHidden = false;
  }

  /**
   * Strips leading CRLF sequence from server output after a line was hidden.
   *
   * **Purpose:** When we hide the user's line, the terminal cursor is at column 0.
   * The next server output often starts with "\r\n" to move to a new line, but
   * since we already cleared the line, this would create a blank row. We strip
   * exactly one CRLF sequence to prevent this.
   *
   * **Precondition:** stripNextLineBreak was set to true in beforeServerOutput()
   * **Postcondition:** stripNextLineBreak is false, leading CRLF (if present) removed
   *
   * @param data Raw server output chunk
   * @returns Transformed data with leading CRLF stripped (if flag was set)
   *
   * @example
   * // stripNextLineBreak = true
   * transformOutput("\r\nYou see a goblin.\r\n> ")
   * // returns: "You see a goblin.\r\n> "
   * // stripNextLineBreak = false
   */
  public transformOutput(data: string): string {
    if (!this.stripNextLineBreak || data.length === 0) {
      return data;
    }

    let startIndex = 0;

    // Handle CRLF as atomic unit: \r\n (Windows style)
    if (data.startsWith(CTRL.CR + CTRL.LF)) {
      startIndex = 2;
    }
    // Handle LF only (Unix style)
    else if (data.startsWith(CTRL.LF)) {
      startIndex = 1;
    }
    // Handle CR only (old Mac style)
    else if (data.startsWith(CTRL.CR)) {
      startIndex = 1;
    }

    // Always reset flag after first call, even if no line break found
    this.stripNextLineBreak = false;

    return startIndex > 0 ? data.slice(startIndex) : data;
  }

  /**
   * Hides the current line before server output is rendered.
   *
   * **Preconditions:**
   * - Must be in edit mode (LINEMODE.edit = true)
   * - Terminal must be ready (after ngAfterViewInit)
   * - Local echo must be enabled (edit mode AND server allows echo)
   * - Line must not already be hidden (prevents double-hide)
   * - Must have content to hide (prompt or user input)
   *
   * **Operation:**
   * 1. Clear terminal line (cursor moves to column 0)
   * 2. Set stripNextLineBreak flag (for transformOutput)
   * 3. Mark line as hidden
   *
   * **Postcondition:**
   * - Terminal line is cleared
   * - lineHidden = true
   * - stripNextLineBreak = true
   * - currentPrompt preserved (not cleared)
   *
   * @param context Current terminal/mode state
   */
  public beforeServerOutput(context: MudPromptContext): void {
    // Guard: Check all preconditions
    if (
      !context.isEditMode ||
      !context.terminalReady ||
      !context.localEchoEnabled ||
      this.lineHidden
    ) {
      return;
    }

    // Check if there's anything to hide (prompt or user input)
    const hasLineContent =
      this.inputController.hasContent() || this.currentPrompt.length > 0;

    if (!hasLineContent) {
      return;
    }

    // Clear the terminal line and prepare for restoration
    this.terminal.write(resetLine);
    this.stripNextLineBreak = true;
    this.lineHidden = true;
    // Note: currentPrompt is NOT cleared - we need it for restore
  }

  /**
   * Schedules prompt restoration after server output has been rendered.
   *
   * **Purpose:** After the server writes its output, we need to restore the
   * user's input line. This happens asynchronously (next microtask) to ensure
   * the terminal has finished rendering the server chunk first.
   *
   * **Preconditions:**
   * - Line must be hidden (lineHidden = true)
   * - Must be in edit mode with local echo
   * - Must have content to restore (prompt or user input)
   *
   * **Operation:**
   * 1. Parse server output to update currentPrompt
   * 2. Create context snapshot (fixes race condition)
   * 3. Schedule async restore via queueMicrotask
   *
   * **Race Condition Fix:** We snapshot the context now rather than passing
   * the reference, because by the time restoreLine() executes, the actual
   * component state may have changed (e.g., mode switch, echo toggle).
   *
   * @param data Server output chunk (after transformOutput)
   * @param context Current terminal/mode state (will be snapshotted)
   */
  public afterServerOutput(data: string, context: MudPromptContext): void {
    // Always track server output to update currentPrompt
    this.trackServerLine(data);

    // Guard: Check if restoration is needed
    if (
      !this.lineHidden ||
      !context.isEditMode ||
      !context.terminalReady ||
      !context.localEchoEnabled
    ) {
      return;
    }

    // Check if there's anything to restore
    if (!this.inputController.hasContent() && this.currentPrompt.length === 0) {
      return;
    }

    // Create context snapshot to avoid race condition
    const contextSnapshot: MudPromptContext = {
      isEditMode: context.isEditMode,
      terminalReady: context.terminalReady,
      localEchoEnabled: context.localEchoEnabled,
    };

    // Schedule async restore (terminal needs to finish rendering first)
    queueMicrotask(() => this.restoreLine(contextSnapshot));
  }

  /**
   * Restores the hidden line to the terminal (async, called via queueMicrotask).
   *
   * **Preconditions:**
   * - lineHidden must be true
   * - Context must still be valid (edit mode, terminal ready, echo enabled)
   * - Terminal has finished rendering server output
   *
   * **Operation:**
   * 1. Validate state (if invalid, clear lineHidden flag and abort)
   * 2. Get input snapshot from controller
   * 3. Validate snapshot integrity (cursor within buffer bounds)
   * 4. Clear terminal line
   * 5. Write currentPrompt (if any)
   * 6. Write user's input buffer
   * 7. Reposition cursor to match snapshot
   * 8. Update state flags
   *
   * **Postcondition:**
   * - Terminal displays: currentPrompt + user buffer
   * - Cursor is at correct position
   * - lineHidden = false
   *
   * @param context Snapshotted context from afterServerOutput (immutable)
   */
  private restoreLine(context: MudPromptContext): void {
    // Guard: Line must be hidden
    if (!this.lineHidden) {
      return;
    }

    // Validate context is still appropriate for restoration
    if (
      !context.isEditMode ||
      !context.terminalReady ||
      !context.localEchoEnabled
    ) {
      // Context changed - clear flag but preserve state for next time
      this.lineHidden = false;
      return;
    }

    // Get current input state
    const snapshot = this.inputController.getSnapshot();

    // Validate snapshot exists
    if (!snapshot) {
      console.error(
        '[MudPromptManager] No snapshot available - aborting restore',
      );
      this.lineHidden = false;
      return;
    }

    // Validate snapshot integrity
    if (snapshot.cursor < 0 || snapshot.cursor > snapshot.buffer.length) {
      console.error(
        '[MudPromptManager] Invalid snapshot:',
        snapshot,
        '- aborting restore',
      );
      this.lineHidden = false;
      return;
    }

    // Clear line and rewrite everything
    this.terminal.write(resetLine);

    // Write prompt if present
    if (this.currentPrompt.length > 0) {
      this.terminal.write(this.currentPrompt);
    }

    // Write user's input buffer
    if (snapshot.buffer.length > 0) {
      this.terminal.write(snapshot.buffer);
    }

    // Reposition cursor if not at end
    const moveLeft = snapshot.buffer.length - snapshot.cursor;
    if (moveLeft > 0) {
      this.terminal.write(cursorLeft(moveLeft));
    }

    // Update state
    this.lineHidden = false;
    // Note: currentPrompt is NOT cleared - we need it for next cycle
  }

  /**
   * Parses server output to maintain currentPrompt state.
   *
   * **Purpose:** As the server sends characters, we track the current line to
   * know what the prompt looks like. This is used when restoring the line.
   *
   * **Behavior:**
   * - CR/LF: Reset currentPrompt (new line started)
   * - BS/DEL: Remove last *visible* character (ANSI-aware)
   * - ESC sequences: Preserve entire sequence in prompt
   * - Regular chars: Append to currentPrompt
   * - Incomplete escapes: Buffer in incompleteEscape for next chunk
   *
   * **ANSI-Aware Backspace:** When server sends backspace, we don't blindly
   * remove the last character. Instead, we skip backwards over ANSI escape
   * sequences to remove the last *visible* character.
   *
   * @param chunk Server output chunk (after transformOutput)
   *
   * @example
   * // Input: "HP:\x1b[31m100\x1b[0m> "
   * // After CR: currentPrompt = ""
   * // After 'H': currentPrompt = "H"
   * // After 'P': currentPrompt = "HP"
   * // After ':\x1b[31m': currentPrompt = "HP:\x1b[31m"
   * // After '1': currentPrompt = "HP:\x1b[31m1"
   * // etc.
   */
  private trackServerLine(chunk: string): void {
    // Prepend any incomplete escape from previous chunk
    const data = this.incompleteEscape + chunk;
    this.incompleteEscape = '';

    let index = 0;

    while (index < data.length) {
      const char = data[index];

      // Line breaks reset the prompt
      if (char === CTRL.CR || char === CTRL.LF) {
        this.currentPrompt = '';
        index += 1;
        continue;
      }

      // Backspace/Delete: Remove last visible character (ANSI-aware)
      if (char === CTRL.BS || char === CTRL.DEL) {
        this.currentPrompt = this.removeLastVisibleChar(this.currentPrompt);
        index += 1;
        continue;
      }

      // Escape sequence: Parse and preserve in prompt
      if (char === CTRL.ESC) {
        const remaining = data.slice(index);
        const consumed = this.skipEscapeSequence(remaining);

        // Check if escape sequence is incomplete (at chunk boundary)
        if (consumed === 0) {
          // Incomplete sequence - buffer it for next chunk
          this.incompleteEscape = remaining;
          break; // Stop processing this chunk
        }

        const parsedSequence = data.slice(index, index + consumed);
        this.currentPrompt += parsedSequence;
        index += consumed;
        continue;
      }

      // Regular character: Append to prompt
      this.currentPrompt += char;
      index += 1;
    }
  }

  /**
   * Detects and measures ANSI escape sequences.
   *
   * **Purpose:** When we encounter ESC in the stream, we need to know how many
   * characters belong to the complete escape sequence so we can preserve it
   * as a unit in the prompt.
   *
   * **Supported Sequences:**
   * - CSI: ESC [ ... [A-Za-z~]  (e.g., ESC[31m for red color)
   * - SS3: ESC O X               (e.g., ESC O H for Home key)
   *
   * **Incomplete Detection:** If the segment starts with ESC but doesn't
   * contain a complete sequence, returns 0 to signal "buffer this for next chunk".
   *
   * @param segment String starting with ESC character
   * @returns Number of characters in the complete escape sequence, or 0 if incomplete
   *
   * @example
   * skipEscapeSequence("\x1b[31mHello") // returns 5 (ESC[31m)
   * skipEscapeSequence("\x1bOH")       // returns 3 (ESCOH)
   * skipEscapeSequence("\x1b[")        // returns 0 (incomplete CSI)
   * skipEscapeSequence("\x1b")         // returns 0 (incomplete, might be CSI or SS3)
   */
  private skipEscapeSequence(segment: string): number {
    // Must start with ESC
    if (!segment.startsWith(CTRL.ESC)) {
      return 0;
    }

    // Check for SS3 (3 characters: ESC O X)
    if (segment.startsWith(SS3)) {
      if (segment.length >= SS3_LEN) {
        return SS3_LEN;
      }
      // Incomplete SS3 (need 1 more character)
      return 0;
    }

    // Check for CSI (ESC [ ...)
    const match = segment.match(CSI_REGEX);
    if (match) {
      return match[0].length;
    }

    // Check if it looks like start of CSI but incomplete (ESC [ without terminator)
    if (segment.length >= 2 && segment[1] === '[') {
      // Incomplete CSI sequence
      return 0;
    }

    // ESC not followed by [ or O - might be incomplete
    if (segment.length === 1) {
      return 0; // Just ESC, need more data
    }

    // ESC followed by something else - treat as single ESC
    return CTRL.ESC.length;
  }

  /**
   * Removes the last visible character from a string, skipping ANSI sequences.
   *
   * **Purpose:** When the server sends a backspace, we want to remove the last
   * *visible* character, not just the last byte. If the last character is part
   * of an ANSI escape sequence, we need to skip backwards over the entire
   * sequence to find the actual visible character to remove.
   *
   * **Algorithm:**
   * 1. Scan backwards from end
   * 2. If we find a regular character, remove it and return
   * 3. If we find an escape sequence, skip over it entirely
   * 4. Repeat until we find a visible character or reach start
   *
   * @param str String potentially containing ANSI escape sequences
   * @returns String with last visible character removed
   *
   * @example
   * removeLastVisibleChar("Hello")           // "Hell"
   * removeLastVisibleChar("Test\x1b[31m")   // "Test\x1b[31m" (no visible char after escape)
   * removeLastVisibleChar("A\x1b[31mB")     // "A\x1b[31m" (removes 'B')
   * removeLastVisibleChar("X\x1b[31mY\x1b[0m") // "X\x1b[31m\x1b[0m" (removes 'Y', keeps both escapes)
   */
  private removeLastVisibleChar(str: string): string {
    if (str.length === 0) {
      return str;
    }

    let pos = str.length - 1;

    // Scan backwards to find last visible character
    while (pos >= 0) {
      const char = str[pos];

      // Found a regular visible character - remove it
      if (char !== CTRL.ESC && !this.isPartOfEscapeSequence(str, pos)) {
        return str.slice(0, pos) + str.slice(pos + 1);
      }

      // If this is part of an escape sequence, skip backwards over it
      if (char === CTRL.ESC || this.isPartOfEscapeSequence(str, pos)) {
        pos = this.findEscapeStart(str, pos);
        pos -= 1; // Move before the escape sequence
        continue;
      }

      pos -= 1;
    }

    // No visible characters found - return as-is
    return str;
  }

  /**
   * Checks if the character at `pos` is part of an escape sequence.
   *
   * @param str String to check
   * @param pos Position to check
   * @returns True if the character at pos is inside an escape sequence
   */
  private isPartOfEscapeSequence(str: string, pos: number): boolean {
    if (pos === 0) {
      return false;
    }

    // Scan backwards to find a potential ESC start
    for (let i = pos; i >= Math.max(0, pos - 20); i--) {
      // Look up to 20 chars back (reasonable escape sequence limit)
      if (str[i] === CTRL.ESC) {
        const segment = str.slice(i);
        const length = this.skipEscapeSequence(segment);
        // Check if pos falls within this escape sequence
        if (length > 0 && i + length > pos) {
          return true;
        }
        break; // Found ESC but pos is not in its range
      }
    }

    return false;
  }

  /**
   * Finds the start position of the escape sequence that includes `pos`.
   *
   * @param str String to search
   * @param pos Position within or at start of escape sequence
   * @returns Index of ESC character starting the sequence
   */
  private findEscapeStart(str: string, pos: number): number {
    // Scan backwards to find ESC
    for (let i = pos; i >= Math.max(0, pos - 20); i--) {
      if (str[i] === CTRL.ESC) {
        return i;
      }
    }
    // Shouldn't reach here if called correctly
    return pos;
  }
}
