import { inject, Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { MudService } from '@webmud3/frontend/core/mud/services/mud.service';
import { namespacedStorage } from '@webmud3/frontend/shared/utils/storage-namespace';

/** Logical key ids matching KeyboardEvent.code on the numpad */
export const NUMPAD_KEYS = [
  'NumpadDivide',
  'NumpadMultiply',
  'NumpadSubtract',
  'Numpad7',
  'Numpad8',
  'Numpad9',
  'NumpadAdd',
  'Numpad4',
  'Numpad5',
  'Numpad6',
  'Numpad1',
  'Numpad2',
  'Numpad3',
  'Numpad0',
  'NumpadDecimal',
  'NumpadEnter',
] as const;

export type NumpadKey = (typeof NUMPAD_KEYS)[number];

/** Map of NumpadKey -> command string sent to the MUD when triggered */
export type NumpadBindings = Partial<Record<NumpadKey, string>>;

const STORAGE_SUFFIX = 'webmud3-numpad-bindings';

const DEFAULT_BINDINGS: NumpadBindings = {
  Numpad8: 'norden',
  Numpad2: 'sueden',
  Numpad4: 'westen',
  Numpad6: 'osten',
  Numpad7: 'nordwesten',
  Numpad9: 'nordosten',
  Numpad1: 'suedwesten',
  Numpad3: 'suedosten',
  Numpad5: 'schau',
  NumpadAdd: 'hoch',
  NumpadSubtract: 'runter',
};

/**
 * Holds the user's numpad key bindings (key -> mud command).
 *
 * State is persisted in localStorage so bindings survive page reloads.
 * Triggering a key sends the bound command to the MUD via MudService.
 */
@Injectable({ providedIn: 'root' })
export class NumpadService {
  private readonly mudService = inject(MudService);

  private readonly bindingsSubject = new BehaviorSubject<NumpadBindings>(
    this.loadBindings(),
  );

  public readonly bindings$ = this.bindingsSubject.asObservable();

  public get bindings(): NumpadBindings {
    return this.bindingsSubject.value;
  }

  /** Sets a single binding and persists. Empty value removes the binding. */
  public setBinding(key: NumpadKey, command: string): void {
    const next: NumpadBindings = { ...this.bindingsSubject.value };

    if (command.trim().length === 0) {
      delete next[key];
    } else {
      next[key] = command;
    }

    this.bindingsSubject.next(next);
    this.persist(next);
  }

  /** Resets all bindings to the built-in defaults. */
  public resetToDefaults(): void {
    this.bindingsSubject.next({ ...DEFAULT_BINDINGS });
    this.persist({ ...DEFAULT_BINDINGS });
  }

  /** Sends the command bound to `key` to the MUD. No-op if unbound. */
  public trigger(key: NumpadKey): void {
    const command = this.bindingsSubject.value[key];

    if (command !== undefined && command.length > 0) {
      this.mudService.sendMessage(command);
    }
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  private loadBindings(): NumpadBindings {
    try {
      const raw = namespacedStorage.get(STORAGE_SUFFIX);
      if (raw) {
        const parsed = JSON.parse(raw) as NumpadBindings;
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    } catch (error) {
      console.warn('[Numpad] Failed to load bindings from localStorage', error);
    }

    return { ...DEFAULT_BINDINGS };
  }

  private persist(bindings: NumpadBindings): void {
    try {
      namespacedStorage.set(STORAGE_SUFFIX, JSON.stringify(bindings));
    } catch (error) {
      console.warn('[Numpad] Failed to save bindings to localStorage', error);
    }
  }
}
