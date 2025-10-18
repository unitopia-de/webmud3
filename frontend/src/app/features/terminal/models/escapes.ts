/**
 * Centralized ANSI/terminal control sequences & helpers.
 *

/** ASCII / terminal control characters. */
export const CTRL = {
  ESC: '\u001b', // Escape (0x1B)
  BS: '\b', // Backspace (0x08)
  DEL: '\u007f', // Delete (0x7F) – some terminals emit DEL instead of BS
  CR: '\r', // Carriage Return – move cursor to column 0
  LF: '\n',
  TAB: '\t',
} as const;

/** CSI (Control Sequence Introducer) — ESC followed by '['. */
export const CSI = `${CTRL.ESC}[`;

/** SS3 (Single Shift 3) — ESC + 'O'; used for arrow keys in some modes. */
export const SS3 = `${CTRL.ESC}O`;

/** Common CSI helpers. */
export const CSI_CMD = {
  cursorLeft: (columns = 1) => `${CSI}${Math.max(columns, 1)}D`,
  cursorRight: (columns = 1) => `${CSI}${Math.max(columns, 1)}C`,
  eraseLineAll: () => `${CSI}2K`,
} as const;

/** Regex that captures generic CSI sequences (ESC [ parameters final). */
export const CSI_REGEX = /^\u001b\[[0-9;]*[A-Za-z~]/;

/** SS3 sequences are always ESC + 'O' + one final char. */
export const SS3_LEN = 3;

/** Public aliases kept for existing callers. */
export const carriageReturn = CTRL.CR;
export const backspace = CTRL.BS;
export const eraseLine = CSI_CMD.eraseLineAll();

/** CR followed by CSI 2K — clear the active line and move to column 0. */
export const resetLine = `${carriageReturn}${eraseLine}`;

/** Simulate the backspace effect (move left, overwrite, move left again). */
export const backspaceErase = `${backspace} ${backspace}`;

/** Cursor helpers for callers that expect standalone functions. */
export function cursorLeft(columns = 1): string {
  return CSI_CMD.cursorLeft(columns);
}

export function cursorRight(columns = 1): string {
  return CSI_CMD.cursorRight(columns);
}

/** Compose multiple fragments without manual string concatenation. */
export function sequence(...segments: string[]): string {
  return segments.join('');
}
