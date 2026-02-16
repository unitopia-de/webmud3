/**
 * Key mapping for a single numpad modifier level (e.g. "", "shift", "ctrl").
 *
 * The prefix identifies the modifier state, and the keys map
 * physical Numpad keys (e.g. "Numpad7") to MUD commands (e.g. "nordwesten").
 */
export interface OneKeypadData {
  /** Modifier prefix (e.g. "", "shift", "ctrl", "alt", "meta") */
  prefix: string;
  /** Map of key code → MUD command */
  keys: Map<string, string>;
}

/**
 * Complete keypad configuration received from the MUD via GMCP Numpad.SendLevel.
 *
 * Holds multiple levels (one per modifier combination) and provides
 * lookup methods for compound keys (modifier|keyCode).
 */
export class KeypadData {
  /** All levels keyed by modifier prefix */
  public readonly levels = new Map<string, OneKeypadData>();

  /**
   * Adds or updates a single key mapping.
   */
  public addKey(prefix: string, key: string, value: string): void {
    let level = this.levels.get(prefix);

    if (level === undefined) {
      level = { prefix, keys: new Map() };
      this.levels.set(prefix, level);
    }

    level.keys.set(key, value);
  }

  /**
   * Gets or creates a level for the given prefix.
   */
  public getLevel(prefix: string): OneKeypadData {
    let level = this.levels.get(prefix);

    if (level === undefined) {
      level = { prefix, keys: new Map() };
      this.levels.set(prefix, level);
    }

    return level;
  }

  /**
   * Sets an entire level (replaces existing).
   */
  public setLevel(data: OneKeypadData): void {
    this.levels.set(data.prefix, data);
  }

  /**
   * Looks up a MUD command for a compound key in the format "prefix|keyCode".
   *
   * @param compoundKey - e.g. "|Numpad7" (no modifier) or "shift|Numpad7"
   * @returns The MUD command, or empty string if not mapped
   */
  public getCompoundKey(compoundKey: string): string {
    const separatorIndex = compoundKey.indexOf('|');

    if (separatorIndex < 0) {
      return '';
    }

    const prefix = compoundKey.slice(0, separatorIndex);
    const key = compoundKey.slice(separatorIndex + 1);
    const level = this.levels.get(prefix);

    return level?.keys.get(key) ?? '';
  }

  /**
   * Checks whether any key mappings exist.
   */
  public get isEmpty(): boolean {
    return this.levels.size === 0;
  }
}

/**
 * Builds a compound key string from a keyboard event's modifiers and key code.
 *
 * @param event - The keyboard event
 * @returns Compound key like "shift|Numpad7" or "|Numpad5"
 */
export function buildCompoundKey(event: KeyboardEvent): string {
  const modifiers: string[] = [];

  if (event.shiftKey) modifiers.push('shift');
  if (event.ctrlKey) modifiers.push('ctrl');
  if (event.altKey) modifiers.push('alt');
  if (event.metaKey) modifiers.push('meta');

  const prefix = modifiers.join('+');

  return `${prefix}|${event.code}`;
}

/**
 * Returns true if the keyboard event targets a numpad or function key
 * that should be intercepted by the keypad system.
 */
export function isNumpadOrFunctionKey(event: KeyboardEvent): boolean {
  return event.code.startsWith('Numpad') || event.code.startsWith('F');
}
