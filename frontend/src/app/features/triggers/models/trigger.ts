/**
 * Domain model for output triggers.
 *
 * A trigger watches the MUD output stream for a regular-expression match and
 * fires an action when it matches: either a colour highlight applied to the
 * matched substring, or a sound playback.
 *
 * See TRIGGER_SPEC.md (sections 3 and 6) for the full contract.
 */

/** Highlight action: recolour the matched substring in the terminal. */
export interface HighlightAction {
  kind: 'highlight';
  /** CSS hex colour, e.g. `#ff8800`. Optional — leave undefined to keep the terminal default. */
  foreground?: string;
  background?: string;
  bold?: boolean;
}

/** Sound action: play a named sound from the sound library. */
export interface SoundAction {
  kind: 'sound';
  /** Fully-qualified id, e.g. `builtin:alert` or `personal:<uuid>`. */
  soundId: string;
  /** Per-trigger gain in the range [0, 1]. Multiplied with the master volume at play time. */
  volume?: number;
}

export type TriggerAction = HighlightAction | SoundAction;

/** Persisted trigger record. */
export interface Trigger {
  id: string;
  name: string;
  /** Regex source without the surrounding slashes, e.g. `you are attacked`. */
  pattern: string;
  /** Regex flags such as `i`, `gi`. May be empty. */
  flags: string;
  action: TriggerAction;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Input shape for creating a trigger — the service fills in id and timestamps. */
export type TriggerDraft = Omit<Trigger, 'id' | 'createdAt' | 'updatedAt'>;

/** Result of `compileTrigger` — either the live RegExp or a syntax error. */
export type CompileResult =
  | { ok: true; regex: RegExp }
  | { ok: false; error: string };

/**
 * Validates and compiles a trigger pattern. Returned RegExp always has the
 * `g` flag set so the engine can iterate over all matches in a line. A `y`
 * flag would also disable lastIndex advancement and is therefore rejected.
 */
export function compileTrigger(
  pattern: string,
  flags: string,
): CompileResult {
  const cleanFlags = normalizeFlags(flags);

  if (cleanFlags === null) {
    return { ok: false, error: 'invalid regex flags' };
  }

  try {
    return { ok: true, regex: new RegExp(pattern, cleanFlags) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Forces the regex into the flags the engine relies on:
 *   - always `g` (the engine iterates with `matchAll`).
 *   - drops `y` (sticky breaks the iterator we want).
 * Returns `null` for unknown flag letters.
 */
function normalizeFlags(flags: string): string | null {
  const allowed = new Set(['g', 'i', 'm', 's', 'u']);
  const seen = new Set<string>();

  for (const ch of flags) {
    if (!allowed.has(ch)) {
      return null;
    }
    seen.add(ch);
  }

  seen.add('g');
  return [...seen].join('');
}
