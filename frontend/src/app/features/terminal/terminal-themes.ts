import type { ITheme } from '@xterm/xterm';

/**
 * Catalogue of terminal themes the user can pick from in the footer menu.
 *
 * Each theme bundles two settings:
 *  - `theme`: optional `ITheme` passed straight to xterm (background,
 *    foreground, cursor, the 16 ANSI colors, …). `undefined` falls back to
 *    xterm's built-in defaults — useful for "Servergenau", which deliberately
 *    leaves everything alone.
 *  - `minimumContrastRatio`: how aggressively xterm rewrites text colours to
 *    keep them legible against the background. `1` means "leave the server
 *    colours exactly as sent"; `7` is WCAG AAA and may shift colours quite
 *    visibly.
 */
export type TerminalThemeId =
  | 'servergenau'
  | 'standard'
  | 'dunkel'
  | 'hell'
  | 'highcontrast';

export type TerminalThemeDefinition = {
  id: TerminalThemeId;
  /** German label shown in the footer menu. */
  label: string;
  /** xterm theme; `undefined` keeps xterm's built-in palette. */
  theme: ITheme | undefined;
  /** Minimum contrast ratio between text and background (1..21). */
  minimumContrastRatio: number;
  /** Short hint for the menu tooltip. */
  hint: string;
};

/**
 * "Servergenau" intentionally has no theme override and disables the contrast
 * adjuster — the user sees colours exactly as UNItopia sent them, even when
 * that produces hard-to-read combinations like dark blue on black.
 */
const SERVERGENAU: TerminalThemeDefinition = {
  id: 'servergenau',
  label: 'Farben: Servergenau',
  theme: undefined,
  minimumContrastRatio: 1,
  hint: 'Originale ANSI-Farben des Servers, keine Kontrast-Korrektur',
};

const STANDARD: TerminalThemeDefinition = {
  id: 'standard',
  label: 'Farben: Standard',
  theme: undefined,
  // WCAG AA-Kontrast: kleinere Korrekturen für Lesbarkeit, sonst xterm-Default.
  minimumContrastRatio: 4.5,
  hint: 'xterm-Standard mit moderater Kontrast-Korrektur',
};

/**
 * Dunkles Theme angelehnt an "VS Code Dark+" — moderne dunkle Standard-Farben,
 * gut lesbar, akzeptable Sättigung.
 */
const DUNKEL: TerminalThemeDefinition = {
  id: 'dunkel',
  label: 'Farben: Dunkel',
  theme: {
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    cursor: '#d4d4d4',
    cursorAccent: '#1e1e1e',
    selectionBackground: '#264f78',
    black: '#000000',
    red: '#cd3131',
    green: '#0dbc79',
    yellow: '#e5e510',
    blue: '#2472c8',
    magenta: '#bc3fbc',
    cyan: '#11a8cd',
    white: '#e5e5e5',
    brightBlack: '#666666',
    brightRed: '#f14c4c',
    brightGreen: '#23d18b',
    brightYellow: '#f5f543',
    brightBlue: '#3b8eea',
    brightMagenta: '#d670d6',
    brightCyan: '#29b8db',
    brightWhite: '#e5e5e5',
  },
  minimumContrastRatio: 4.5,
  hint: 'Dunkles Theme (VS Code Dark+)',
};

/**
 * Helles Theme angelehnt an "VS Code Light" — dunkle Schrift auf weißem
 * Hintergrund. Helle ANSI-Farben werden gegen dunklere Varianten getauscht
 * damit sie nicht im weißen Background untergehen.
 */
const HELL: TerminalThemeDefinition = {
  id: 'hell',
  label: 'Farben: Hell',
  theme: {
    background: '#ffffff',
    foreground: '#333333',
    cursor: '#333333',
    cursorAccent: '#ffffff',
    selectionBackground: '#add6ff',
    black: '#000000',
    red: '#cd3131',
    green: '#00bc00',
    yellow: '#949800',
    blue: '#0451a5',
    magenta: '#bc05bc',
    cyan: '#0598bc',
    white: '#555555',
    brightBlack: '#666666',
    brightRed: '#cd3131',
    brightGreen: '#14ce14',
    brightYellow: '#b5ba00',
    brightBlue: '#0451a5',
    brightMagenta: '#bc05bc',
    brightCyan: '#0598bc',
    brightWhite: '#a5a5a5',
  },
  minimumContrastRatio: 4.5,
  hint: 'Helles Theme (VS Code Light)',
};

/**
 * High-Contrast: schwarz/weiß mit reinen, gesättigten ANSI-Farben. Cursor in
 * Gelb wie das Microsoft High-Contrast-Black-Theme. Kontrast-Ratio 7 (AAA).
 */
const HIGHCONTRAST: TerminalThemeDefinition = {
  id: 'highcontrast',
  label: 'Farben: High Contrast',
  theme: {
    background: '#000000',
    foreground: '#ffffff',
    cursor: '#ffff00',
    cursorAccent: '#000000',
    selectionBackground: '#ffff00',
    black: '#000000',
    red: '#ff0000',
    green: '#00ff00',
    yellow: '#ffff00',
    blue: '#3b8eea',
    magenta: '#ff00ff',
    cyan: '#00ffff',
    white: '#ffffff',
    brightBlack: '#808080',
    brightRed: '#ff0000',
    brightGreen: '#00ff00',
    brightYellow: '#ffff00',
    brightBlue: '#3b8eea',
    brightMagenta: '#ff00ff',
    brightCyan: '#00ffff',
    brightWhite: '#ffffff',
  },
  minimumContrastRatio: 7,
  hint: 'Maximaler Kontrast (WCAG AAA)',
};

export const TERMINAL_THEMES: Record<TerminalThemeId, TerminalThemeDefinition> =
  {
    servergenau: SERVERGENAU,
    standard: STANDARD,
    dunkel: DUNKEL,
    hell: HELL,
    highcontrast: HIGHCONTRAST,
  };

export const TERMINAL_THEME_ORDER: TerminalThemeId[] = [
  'servergenau',
  'standard',
  'dunkel',
  'hell',
  'highcontrast',
];

export const DEFAULT_TERMINAL_THEME_ID: TerminalThemeId = 'standard';

export function isTerminalThemeId(value: unknown): value is TerminalThemeId {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(TERMINAL_THEMES, value)
  );
}
