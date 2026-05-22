/**
 * Domain model for the trigger sound library.
 *
 * Two sources coexist:
 *   - Built-in sounds ship with the app as static assets.
 *   - Personal sounds are imported by the user and persisted in localStorage
 *     as base64 data URLs.
 *
 * See TRIGGER_SPEC.md sections 3.2 and 4.
 */

export interface BuiltinSound {
  kind: 'builtin';
  id: string;
  label: string;
  /** Relative path served from the app, e.g. `assets/sounds/alert.ogg`. */
  url: string;
}

export interface PersonalSound {
  kind: 'personal';
  id: string;
  label: string;
  /** MIME type as reported by the imported file, e.g. `audio/ogg`. */
  mimeType: string;
  /** Self-contained data URL — what we play and what we persist. */
  dataUrl: string;
  sizeBytes: number;
  createdAt: number;
}

export type Sound = BuiltinSound | PersonalSound;

/** Prefixes that namespace the two sources inside a single id string. */
export const BUILTIN_PREFIX = 'builtin:';
export const PERSONAL_PREFIX = 'personal:';

export function builtinSoundId(rawId: string): string {
  return `${BUILTIN_PREFIX}${rawId}`;
}

export function personalSoundId(rawId: string): string {
  return `${PERSONAL_PREFIX}${rawId}`;
}

export type SoundKind = 'builtin' | 'personal' | 'unknown';

/** Splits a namespaced id back into kind + raw id, or `unknown` for malformed input. */
export function parseSoundId(
  id: string,
): { kind: SoundKind; rawId: string } {
  if (id.startsWith(BUILTIN_PREFIX)) {
    return { kind: 'builtin', rawId: id.slice(BUILTIN_PREFIX.length) };
  }
  if (id.startsWith(PERSONAL_PREFIX)) {
    return { kind: 'personal', rawId: id.slice(PERSONAL_PREFIX.length) };
  }
  return { kind: 'unknown', rawId: id };
}
