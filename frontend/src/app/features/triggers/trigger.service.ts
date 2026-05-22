import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { namespacedStorage } from '@webmud3/frontend/shared/utils/storage-namespace';

import {
  compileTrigger,
  type Trigger,
  type TriggerDraft,
} from './models/trigger';

const STORAGE_SUFFIX = 'wm3cc.triggers.v1';

export interface TriggerSettings {
  globallyEnabled: boolean;
  /** Multiplier in [0, 1] applied on top of each trigger's own volume. */
  masterVolume: number;
}

const SETTINGS_SUFFIX = 'wm3cc.triggers.settings.v1';

const DEFAULT_SETTINGS: TriggerSettings = {
  globallyEnabled: true,
  masterVolume: 1,
};

/**
 * Stores the user's trigger list and the global trigger settings.
 *
 * Persists both to namespaced localStorage so the data survives reloads but
 * stays disjoint between the production and test deployments that share an
 * origin.
 *
 * Validation is intentionally light at this layer — the regex is compiled
 * once on `save` to surface syntax errors immediately, but the engine
 * recompiles per call (see TriggerEngineService).
 */
@Injectable({ providedIn: 'root' })
export class TriggerService {
  private readonly triggersSubject = new BehaviorSubject<Trigger[]>([]);
  private readonly settingsSubject = new BehaviorSubject<TriggerSettings>(
    DEFAULT_SETTINGS,
  );

  public readonly triggers$: Observable<Trigger[]> =
    this.triggersSubject.asObservable();
  public readonly settings$: Observable<TriggerSettings> =
    this.settingsSubject.asObservable();

  constructor() {
    this.loadFromStorage();
  }

  // ---------------------------------------------------------------------------
  // Snapshots
  // ---------------------------------------------------------------------------

  public get triggers(): Trigger[] {
    return this.triggersSubject.value;
  }

  public get settings(): TriggerSettings {
    return this.settingsSubject.value;
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  /**
   * Adds a new trigger. The pattern is validated; a syntax error throws
   * before anything is persisted.
   */
  public create(draft: TriggerDraft): Trigger {
    this.assertValidPattern(draft.pattern, draft.flags);

    const now = Date.now();
    const trigger: Trigger = {
      ...draft,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };

    this.triggersSubject.next([...this.triggersSubject.value, trigger]);
    this.persistTriggers();
    return trigger;
  }

  /** Replaces the fields of an existing trigger. Unknown id throws. */
  public update(id: string, patch: Partial<TriggerDraft>): Trigger {
    const current = this.triggersSubject.value;
    const idx = current.findIndex((t) => t.id === id);

    if (idx < 0) {
      throw new Error(`TriggerService.update: unknown id "${id}"`);
    }

    const merged: Trigger = {
      ...current[idx],
      ...patch,
      updatedAt: Date.now(),
    };

    this.assertValidPattern(merged.pattern, merged.flags);

    const next = [...current];
    next[idx] = merged;
    this.triggersSubject.next(next);
    this.persistTriggers();
    return merged;
  }

  public delete(id: string): boolean {
    const current = this.triggersSubject.value;
    const next = current.filter((t) => t.id !== id);

    if (next.length === current.length) {
      return false;
    }

    this.triggersSubject.next(next);
    this.persistTriggers();
    return true;
  }

  /**
   * Moves a trigger inside the ordered list. Order matters because the engine
   * applies triggers in list order and earlier highlights win on overlap.
   */
  public reorder(id: string, toIndex: number): void {
    const current = this.triggersSubject.value;
    const fromIndex = current.findIndex((t) => t.id === id);

    if (fromIndex < 0) {
      throw new Error(`TriggerService.reorder: unknown id "${id}"`);
    }

    const clamped = Math.max(0, Math.min(toIndex, current.length - 1));
    if (clamped === fromIndex) {
      return;
    }

    const next = [...current];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(clamped, 0, moved);
    this.triggersSubject.next(next);
    this.persistTriggers();
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  public setGloballyEnabled(enabled: boolean): void {
    if (this.settingsSubject.value.globallyEnabled === enabled) {
      return;
    }
    this.settingsSubject.next({
      ...this.settingsSubject.value,
      globallyEnabled: enabled,
    });
    this.persistSettings();
  }

  public setMasterVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    if (this.settingsSubject.value.masterVolume === clamped) {
      return;
    }
    this.settingsSubject.next({
      ...this.settingsSubject.value,
      masterVolume: clamped,
    });
    this.persistSettings();
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  private loadFromStorage(): void {
    this.loadTriggers();
    this.loadSettings();
  }

  private loadTriggers(): void {
    const raw = namespacedStorage.get(STORAGE_SUFFIX);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        console.warn('[TriggerService] Stored triggers are not an array, ignoring');
        return;
      }

      const valid: Trigger[] = [];
      for (const entry of parsed) {
        if (isPersistedTrigger(entry)) {
          valid.push(entry);
        }
      }

      this.triggersSubject.next(valid);
    } catch (err) {
      console.warn('[TriggerService] Failed to parse stored triggers', err);
    }
  }

  private loadSettings(): void {
    const raw = namespacedStorage.get(SETTINGS_SUFFIX);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<TriggerSettings>;
      this.settingsSubject.next({
        globallyEnabled:
          typeof parsed.globallyEnabled === 'boolean'
            ? parsed.globallyEnabled
            : DEFAULT_SETTINGS.globallyEnabled,
        masterVolume:
          typeof parsed.masterVolume === 'number' &&
          parsed.masterVolume >= 0 &&
          parsed.masterVolume <= 1
            ? parsed.masterVolume
            : DEFAULT_SETTINGS.masterVolume,
      });
    } catch (err) {
      console.warn('[TriggerService] Failed to parse stored settings', err);
    }
  }

  private persistTriggers(): void {
    namespacedStorage.set(
      STORAGE_SUFFIX,
      JSON.stringify(this.triggersSubject.value),
    );
  }

  private persistSettings(): void {
    namespacedStorage.set(
      SETTINGS_SUFFIX,
      JSON.stringify(this.settingsSubject.value),
    );
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private assertValidPattern(pattern: string, flags: string): void {
    const result = compileTrigger(pattern, flags);
    if (!result.ok) {
      throw new Error(`Invalid trigger pattern: ${result.error}`);
    }
  }
}

function isPersistedTrigger(value: unknown): value is Trigger {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const t = value as Record<string, unknown>;
  if (
    typeof t['id'] !== 'string' ||
    typeof t['name'] !== 'string' ||
    typeof t['pattern'] !== 'string' ||
    typeof t['flags'] !== 'string' ||
    typeof t['enabled'] !== 'boolean' ||
    typeof t['createdAt'] !== 'number' ||
    typeof t['updatedAt'] !== 'number'
  ) {
    return false;
  }
  const action = t['action'];
  if (typeof action !== 'object' || action === null) {
    return false;
  }
  const kind = (action as Record<string, unknown>)['kind'];
  return kind === 'highlight' || kind === 'sound';
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without randomUUID (older test runners).
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
