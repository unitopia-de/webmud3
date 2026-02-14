/**
 * A single character attribute (STR, INT, CON, DEX).
 */
export interface CharacterStat {
  /** Short key (e.g. "str", "int", "con", "dex") */
  key: string;
  /** Human-readable label (e.g. "Stärke", "Intelligenz") */
  label: string;
  /** Current value as string (may contain decimals like "59,8") */
  value: string;
}

/**
 * Vital statistics (health/spell points).
 */
export interface CharacterVitals {
  hp?: number;
  sp?: number;
  maxHp?: number;
  maxSp?: number;
}

/**
 * Full character data as received from multiple GMCP Char.* messages.
 */
export interface CharacterData {
  /** Character name */
  name: string;
  /** Full name including title */
  fullname?: string;
  /** Gender identifier */
  gender?: string;
  /** Wizard level (0 = player, >0 = wizard) */
  wizard: number;
  /** Whether the character is a wizard */
  isWizard: boolean;
  /** Name at MUD (e.g. "Myonara@UNItopia") */
  nameAtMud?: string;
  /** Available status variable definitions (from Char.StatusVars) */
  statusVars: Record<string, string>;
  /** Current status values (from Char.Status, e.g. guild, race, rank) */
  status: Record<string, string | number>;
  /** Health and spell points */
  vitals: CharacterVitals;
  /** Character attributes */
  stats: CharacterStat[];
}

/**
 * Creates a fresh CharacterData with default values.
 */
export function createCharacterData(name: string): CharacterData {
  return {
    name,
    wizard: 0,
    isWizard: false,
    statusVars: {},
    status: {},
    vitals: {},
    stats: [],
  };
}

/** Map of stat keys to German labels */
const STAT_LABELS: Record<string, string> = {
  str: 'Stärke',
  int: 'Intelligenz',
  con: 'Ausdauer',
  dex: 'Geschicklichkeit',
};

/** Canonical order for displaying stats */
const STAT_ORDER = ['str', 'int', 'con', 'dex'];

/**
 * Parses a pipe-delimited vitals string into structured data.
 *
 * Input format from MUD: `"hp=100|sp=80|maxhp=120|maxsp=100"`
 * Also handles plain number format: `"100|80"` (hp|sp only)
 *
 * @param input - The raw vitals string from GMCP Char.Vitals
 * @returns Parsed vitals object
 */
export function parseVitals(input: string): CharacterVitals {
  const vitals: CharacterVitals = {};

  if (input.length === 0) {
    return vitals;
  }

  const parts = input.split('|');

  for (const part of parts) {
    const eqIndex = part.indexOf('=');

    if (eqIndex > 0) {
      const key = part.substring(0, eqIndex).toLowerCase().trim();
      const value = parseFloat(part.substring(eqIndex + 1).trim().replace(',', '.'));

      if (isNaN(value)) {
        continue;
      }

      switch (key) {
        case 'hp':
          vitals.hp = value;
          break;
        case 'sp':
          vitals.sp = value;
          break;
        case 'maxhp':
          vitals.maxHp = value;
          break;
        case 'maxsp':
          vitals.maxSp = value;
          break;
      }
    }
  }

  return vitals;
}

/**
 * Parses a pipe-delimited stats string into an ordered array.
 *
 * Input format from MUD: `"con=34,2|dex=59,7|int=130|str=59,8"`
 *
 * @param input - The raw stats string from GMCP Char.Stats
 * @returns Ordered array of CharacterStat objects
 */
export function parseStats(input: string): CharacterStat[] {
  if (input.length === 0) {
    return [];
  }

  const parts = input.split('|');
  const statMap = new Map<string, CharacterStat>();

  for (const part of parts) {
    const eqIndex = part.indexOf('=');

    if (eqIndex > 0) {
      const key = part.substring(0, eqIndex).toLowerCase().trim();
      const value = part.substring(eqIndex + 1).trim();

      statMap.set(key, {
        key,
        label: STAT_LABELS[key] ?? key.toUpperCase(),
        value,
      });
    }
  }

  // Return in canonical order
  const result: CharacterStat[] = [];

  for (const key of STAT_ORDER) {
    const stat = statMap.get(key);

    if (stat !== undefined) {
      result.push(stat);
    }
  }

  // Append any stats not in the canonical order
  for (const [key, stat] of statMap) {
    if (!STAT_ORDER.includes(key)) {
      result.push(stat);
    }
  }

  return result;
}

/**
 * Formats a compact status summary string from status key-value pairs.
 *
 * @param status - The status record from Char.Status
 * @param statusVars - The variable definitions from Char.StatusVars (key -> label)
 * @returns A compact display string, e.g. "Zauberer, Mensch, Erzmagier"
 */
export function formatStatusSummary(
  status: Record<string, string | number>,
  statusVars: Record<string, string>,
): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(status)) {
    if (value !== '' && value !== 0) {
      parts.push(String(value));
    }
  }

  return parts.join(', ');
}
