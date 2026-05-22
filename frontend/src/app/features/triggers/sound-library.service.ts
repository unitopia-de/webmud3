import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs';

import { namespacedStorage } from '@webmud3/frontend/shared/utils/storage-namespace';

import {
  BUILTIN_PREFIX,
  type BuiltinSound,
  PERSONAL_PREFIX,
  type PersonalSound,
  parseSoundId,
  type Sound,
} from './models/sound';

const PERSONAL_STORAGE_SUFFIX = 'wm3cc.sounds.personal.v1';
const MANIFEST_URL = 'assets/sounds/manifest.json';

/** Single personal sound may not exceed 512 KB encoded as a data URL. */
export const MAX_PERSONAL_SOUND_BYTES = 512 * 1024;

/** Total personal-sound footprint capped at 4 MB to leave room for other state. */
export const MAX_PERSONAL_TOTAL_BYTES = 4 * 1024 * 1024;

/** Accepted MIME types for personal imports. */
export const ALLOWED_MIME_TYPES = [
  'audio/ogg',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
];

/** Raw shape of `assets/sounds/manifest.json`. */
interface SoundManifest {
  version: number;
  sounds: Array<{ id: string; label: string; file: string }>;
}

/**
 * Source of all trigger-side sounds.
 *
 * Built-in sounds come from a static manifest fetched once at app start;
 * personal sounds are imported by the user and persisted in namespaced
 * localStorage as base64 data URLs. The two sources share a single id space
 * via the `builtin:` / `personal:` prefixes.
 */
@Injectable({ providedIn: 'root' })
export class SoundLibraryService {
  private readonly http = inject(HttpClient);

  private readonly builtinSubject = new BehaviorSubject<BuiltinSound[]>([]);
  private readonly personalSubject = new BehaviorSubject<PersonalSound[]>([]);

  public readonly builtin$: Observable<BuiltinSound[]> =
    this.builtinSubject.asObservable();
  public readonly personal$: Observable<PersonalSound[]> =
    this.personalSubject.asObservable();

  /** Resolves once the built-in manifest has been loaded (or has failed). */
  private readonly manifestReady: Promise<void>;

  constructor() {
    this.loadPersonalFromStorage();
    this.manifestReady = this.loadManifest();
  }

  // ---------------------------------------------------------------------------
  // Snapshots
  // ---------------------------------------------------------------------------

  public get builtin(): BuiltinSound[] {
    return this.builtinSubject.value;
  }

  public get personal(): PersonalSound[] {
    return this.personalSubject.value;
  }

  public get personalBytesUsed(): number {
    return this.personalSubject.value.reduce((sum, s) => sum + s.sizeBytes, 0);
  }

  public whenReady(): Promise<void> {
    return this.manifestReady;
  }

  // ---------------------------------------------------------------------------
  // Resolution
  // ---------------------------------------------------------------------------

  /** Returns the sound for a namespaced id, or `null` if it no longer exists. */
  public resolve(id: string): Sound | null {
    const { kind, rawId } = parseSoundId(id);

    if (kind === 'builtin') {
      return this.builtinSubject.value.find((s) => s.id === rawId) ?? null;
    }
    if (kind === 'personal') {
      return this.personalSubject.value.find((s) => s.id === rawId) ?? null;
    }
    return null;
  }

  /** Returns the playable URL for a sound, or `null` if unknown. */
  public resolveUrl(id: string): string | null {
    const sound = this.resolve(id);
    if (sound === null) {
      return null;
    }
    return sound.kind === 'builtin' ? sound.url : sound.dataUrl;
  }

  // ---------------------------------------------------------------------------
  // Personal sound CRUD
  // ---------------------------------------------------------------------------

  /**
   * Imports a personal sound. The file is read as a data URL up-front so the
   * size check operates on the actual persisted payload, not the raw bytes.
   *
   * Throws on quota violation; the store stays untouched on failure.
   */
  public async importPersonal(file: File, label?: string): Promise<PersonalSound> {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new Error(`Unsupported MIME type: ${file.type || 'unknown'}`);
    }

    const dataUrl = await readFileAsDataUrl(file);
    const sizeBytes = dataUrl.length;

    if (sizeBytes > MAX_PERSONAL_SOUND_BYTES) {
      throw new Error(
        `Sound too large: ${sizeBytes} B (max ${MAX_PERSONAL_SOUND_BYTES} B)`,
      );
    }
    if (this.personalBytesUsed + sizeBytes > MAX_PERSONAL_TOTAL_BYTES) {
      throw new Error(
        `Personal sound quota exceeded (${this.personalBytesUsed + sizeBytes} of ${MAX_PERSONAL_TOTAL_BYTES} B)`,
      );
    }

    const sound: PersonalSound = {
      kind: 'personal',
      id: generateId(),
      label: label?.trim() || stripExtension(file.name) || 'Untitled',
      mimeType: file.type,
      dataUrl,
      sizeBytes,
      createdAt: Date.now(),
    };

    const next = [...this.personalSubject.value, sound];
    this.personalSubject.next(next);

    try {
      this.persistPersonal();
    } catch (err) {
      // Roll back the in-memory change so the service stays in sync with storage.
      this.personalSubject.next(this.personalSubject.value.slice(0, -1));
      throw err;
    }

    return sound;
  }

  public renamePersonal(id: string, label: string): void {
    const idx = this.personalSubject.value.findIndex((s) => s.id === id);
    if (idx < 0) {
      throw new Error(`SoundLibrary.renamePersonal: unknown id "${id}"`);
    }
    const trimmed = label.trim();
    if (!trimmed) {
      throw new Error('SoundLibrary.renamePersonal: label is empty');
    }

    const next = [...this.personalSubject.value];
    next[idx] = { ...next[idx], label: trimmed };
    this.personalSubject.next(next);
    this.persistPersonal();
  }

  public deletePersonal(id: string): boolean {
    const current = this.personalSubject.value;
    const next = current.filter((s) => s.id !== id);

    if (next.length === current.length) {
      return false;
    }

    this.personalSubject.next(next);
    this.persistPersonal();
    return true;
  }

  // ---------------------------------------------------------------------------
  // Built-in manifest loading
  // ---------------------------------------------------------------------------

  private async loadManifest(): Promise<void> {
    try {
      const manifest = await firstValueFrom(
        this.http.get<SoundManifest>(MANIFEST_URL),
      );

      const baseDir = MANIFEST_URL.replace(/manifest\.json$/, '');
      const list: BuiltinSound[] = (manifest.sounds ?? []).map((entry) => ({
        kind: 'builtin' as const,
        id: entry.id,
        label: entry.label,
        url: entry.file.startsWith('http') ? entry.file : `${baseDir}${entry.file}`,
      }));

      this.builtinSubject.next(list);
    } catch (err) {
      console.warn('[SoundLibrary] Could not load built-in manifest', err);
      this.builtinSubject.next([]);
    }
  }

  // ---------------------------------------------------------------------------
  // Personal persistence
  // ---------------------------------------------------------------------------

  private loadPersonalFromStorage(): void {
    const raw = namespacedStorage.get(PERSONAL_STORAGE_SUFFIX);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return;
      }

      const valid: PersonalSound[] = [];
      for (const entry of parsed) {
        if (isPersistedPersonal(entry)) {
          valid.push(entry);
        }
      }
      this.personalSubject.next(valid);
    } catch (err) {
      console.warn('[SoundLibrary] Failed to parse stored personal sounds', err);
    }
  }

  private persistPersonal(): void {
    try {
      namespacedStorage.set(
        PERSONAL_STORAGE_SUFFIX,
        JSON.stringify(this.personalSubject.value),
      );
    } catch (err) {
      throw new Error(
        `localStorage rejected the write (quota?): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

// Exposed for tests; keep the same surface as the lookup callers expect.
export { BUILTIN_PREFIX, PERSONAL_PREFIX };

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Unexpected FileReader result type'));
        return;
      }
      resolve(result);
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

function stripExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx > 0 ? filename.slice(0, idx) : filename;
}

function isPersistedPersonal(value: unknown): value is PersonalSound {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const s = value as Record<string, unknown>;
  return (
    s['kind'] === 'personal' &&
    typeof s['id'] === 'string' &&
    typeof s['label'] === 'string' &&
    typeof s['mimeType'] === 'string' &&
    typeof s['dataUrl'] === 'string' &&
    typeof s['sizeBytes'] === 'number' &&
    typeof s['createdAt'] === 'number'
  );
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
