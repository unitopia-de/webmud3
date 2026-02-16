import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import type { ITheme } from '@xterm/xterm';

/**
 * User-configurable color settings for the terminal.
 */
export interface ColorSettings {
  /** Invert all terminal colors */
  invertColors: boolean;
  /** Swap black and white (light background mode) */
  blackOnWhite: boolean;
  /** Disable all colors (monochrome mode) */
  disableColors: boolean;
  /** Color for local echo text */
  localEchoColor: string;
}

/** Default Catppuccin Mocha terminal colors */
const DEFAULT_SETTINGS: ColorSettings = {
  invertColors: false,
  blackOnWhite: false,
  disableColors: false,
  localEchoColor: '#a6e3a1',
};

/** Storage key for persisting settings in localStorage */
const STORAGE_KEY = 'webmud3-color-settings';

/** Standard ANSI 16-color palette (Catppuccin Mocha inspired) */
const ANSI_COLORS = {
  black: '#45475a',
  red: '#f38ba8',
  green: '#a6e3a1',
  yellow: '#f9e2af',
  blue: '#89b4fa',
  magenta: '#cba6f7',
  cyan: '#94e2d5',
  white: '#bac2de',
  brightBlack: '#585b70',
  brightRed: '#f38ba8',
  brightGreen: '#a6e3a1',
  brightYellow: '#f9e2af',
  brightBlue: '#89b4fa',
  brightMagenta: '#cba6f7',
  brightCyan: '#94e2d5',
  brightWhite: '#a6adc8',
};

/**
 * Service for managing terminal color settings.
 *
 * Responsibilities:
 * - Stores color preferences (invert, B/W, monochrome, echo color)
 * - Persists settings to localStorage
 * - Generates xterm.js ITheme objects from current settings
 * - Exposes reactive observable for setting changes
 *
 * Replaces PrimeNG DynamicDialog-based approach from u1 with localStorage
 * persistence and xterm.js Theme API integration.
 */
@Injectable({ providedIn: 'root' })
export class ColorSettingsService {
  private readonly settings = new BehaviorSubject<ColorSettings>(this.loadFromStorage());

  /** Observable stream of current color settings */
  public readonly settings$: Observable<ColorSettings> = this.settings.asObservable();

  /**
   * Returns the current color settings snapshot.
   */
  public get current(): ColorSettings {
    return this.settings.value;
  }

  /**
   * Updates and persists the color settings.
   */
  public save(settings: ColorSettings): void {
    this.settings.next(settings);
    this.saveToStorage(settings);

    console.info('[ColorSettings] Settings saved:', settings);
  }

  /**
   * Updates a single setting property.
   */
  public update(patch: Partial<ColorSettings>): void {
    this.save({ ...this.settings.value, ...patch });
  }

  /**
   * Resets to default settings.
   */
  public reset(): void {
    this.save({ ...DEFAULT_SETTINGS });
  }

  /**
   * Generates an xterm.js ITheme from the current color settings.
   *
   * Applies transformations in order:
   * 1. Start with default Catppuccin Mocha colors
   * 2. If `disableColors`: all ANSI colors → foreground/background only
   * 3. If `invertColors`: invert all color values
   * 4. If `blackOnWhite`: swap background/foreground to light mode
   */
  public getXtermTheme(): ITheme {
    const s = this.settings.value;

    let theme: ITheme = {
      background: '#1e1e2e',
      foreground: '#cdd6f4',
      cursor: '#f5e0dc',
      cursorAccent: '#1e1e2e',
      selectionBackground: '#585b70',
      selectionForeground: '#cdd6f4',
      ...ANSI_COLORS,
    };

    if (s.disableColors) {
      theme = this.applyMonochrome(theme);
    }

    if (s.invertColors) {
      theme = this.applyInversion(theme);
    }

    if (s.blackOnWhite) {
      theme = this.applyBlackOnWhite(theme);
    }

    return theme;
  }

  /**
   * Removes all colors, keeping only foreground and background.
   */
  private applyMonochrome(theme: ITheme): ITheme {
    const fg = theme.foreground ?? '#cdd6f4';
    const bg = theme.background ?? '#1e1e2e';

    return {
      ...theme,
      black: bg,
      red: fg,
      green: fg,
      yellow: fg,
      blue: fg,
      magenta: fg,
      cyan: fg,
      white: fg,
      brightBlack: bg,
      brightRed: fg,
      brightGreen: fg,
      brightYellow: fg,
      brightBlue: fg,
      brightMagenta: fg,
      brightCyan: fg,
      brightWhite: fg,
    };
  }

  /**
   * Inverts all color values (RGB component-wise).
   */
  private applyInversion(theme: ITheme): ITheme {
    const invert = (color: string | undefined): string | undefined => {
      if (color === undefined) {
        return undefined;
      }

      return this.invertHexColor(color);
    };

    return {
      background: invert(theme.background),
      foreground: invert(theme.foreground),
      cursor: invert(theme.cursor),
      cursorAccent: invert(theme.cursorAccent),
      selectionBackground: invert(theme.selectionBackground),
      selectionForeground: invert(theme.selectionForeground),
      black: invert(theme.black),
      red: invert(theme.red),
      green: invert(theme.green),
      yellow: invert(theme.yellow),
      blue: invert(theme.blue),
      magenta: invert(theme.magenta),
      cyan: invert(theme.cyan),
      white: invert(theme.white),
      brightBlack: invert(theme.brightBlack),
      brightRed: invert(theme.brightRed),
      brightGreen: invert(theme.brightGreen),
      brightYellow: invert(theme.brightYellow),
      brightBlue: invert(theme.brightBlue),
      brightMagenta: invert(theme.brightMagenta),
      brightCyan: invert(theme.brightCyan),
      brightWhite: invert(theme.brightWhite),
    };
  }

  /**
   * Swaps to a light-background mode.
   */
  private applyBlackOnWhite(theme: ITheme): ITheme {
    return {
      ...theme,
      background: '#eff1f5',
      foreground: '#4c4f69',
      cursor: '#dc8a78',
      cursorAccent: '#eff1f5',
      selectionBackground: '#acb0be',
      selectionForeground: '#4c4f69',
    };
  }

  /**
   * Inverts a hex color (e.g. #1e1e2e → #e1e1d1).
   */
  private invertHexColor(hex: string): string {
    const clean = hex.replace('#', '');

    if (clean.length !== 6) {
      return hex;
    }

    const r = 255 - parseInt(clean.substring(0, 2), 16);
    const g = 255 - parseInt(clean.substring(2, 4), 16);
    const b = 255 - parseInt(clean.substring(4, 6), 16);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Loads settings from localStorage, falls back to defaults.
   */
  private loadFromStorage(): ColorSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (stored !== null) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) as Partial<ColorSettings> };
      }
    } catch (error) {
      console.warn('[ColorSettings] Failed to load from localStorage:', error);
    }

    return { ...DEFAULT_SETTINGS };
  }

  /**
   * Saves settings to localStorage.
   */
  private saveToStorage(settings: ColorSettings): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('[ColorSettings] Failed to save to localStorage:', error);
    }
  }
}
