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

/**
 * Modifier flags that select a layer. `meta` is the Cmd key on macOS.
 */
export interface NumpadModifiers {
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  meta: boolean;
}

/**
 * A layer is identified by a canonical prefix string built from the active
 * modifiers in fixed order (Shift → Ctrl → Alt → Meta). The empty string is
 * the "no modifier" layer. Examples: "", "Shift", "Ctrl", "ShiftCtrl",
 * "Alt", "Meta", "ShiftAlt", … (mirrors the u1_master keypad scheme).
 */
export type NumpadLayerId = string;

/** All layers: layer id -> bindings for that layer. */
export type NumpadLayers = Record<NumpadLayerId, NumpadBindings>;

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

/** Default layer set: only the no-modifier layer is pre-filled. */
function defaultLayers(): NumpadLayers {
  return { '': { ...DEFAULT_BINDINGS } };
}

/**
 * Builds the canonical layer id for a set of modifiers. Order is fixed so the
 * same combination always maps to the same id regardless of how it was
 * produced (physical keys vs. config checkboxes).
 */
export function numpadLayerId(mods: NumpadModifiers): NumpadLayerId {
  let id = '';
  if (mods.shift) id += 'Shift';
  if (mods.ctrl) id += 'Ctrl';
  if (mods.alt) id += 'Alt';
  if (mods.meta) id += 'Meta';
  return id;
}

/** True if a KeyboardEvent.code belongs to the numpad. */
export function isNumpadCode(code: string): code is NumpadKey {
  return (NUMPAD_KEYS as readonly string[]).includes(code);
}

/**
 * Holds the user's numpad key bindings per modifier layer (key -> mud command).
 *
 * State is persisted in localStorage so bindings survive page reloads. A flat
 * legacy layout (`{ Numpad8: "norden", … }`) is migrated into the no-modifier
 * layer on load.
 *
 * Triggering sends the bound command to the MUD via MudService. Physical key
 * presses are evaluated with `triggerFromEvent`, which the numpad window's
 * input line and the `/ez` input line both call so all layers behave
 * identically everywhere.
 */
@Injectable({ providedIn: 'root' })
export class NumpadService {
  private readonly mudService = inject(MudService);

  private readonly layersSubject = new BehaviorSubject<NumpadLayers>(
    this.loadLayers(),
  );

  public readonly layers$ = this.layersSubject.asObservable();

  public get layers(): NumpadLayers {
    return this.layersSubject.value;
  }

  /** Returns the bindings for a single layer (empty object if none yet). */
  public bindingsForLayer(layerId: NumpadLayerId): NumpadBindings {
    return this.layersSubject.value[layerId] ?? {};
  }

  /** Resolves the command bound to `key` in the layer for `mods`. */
  public getCommand(
    key: NumpadKey,
    mods: NumpadModifiers,
  ): string | undefined {
    const layer = this.layersSubject.value[numpadLayerId(mods)];
    return layer?.[key];
  }

  /**
   * Sets a single binding in the given layer and persists. An empty value
   * removes the binding (and drops the layer if it becomes empty).
   */
  public setBinding(
    layerId: NumpadLayerId,
    key: NumpadKey,
    command: string,
  ): void {
    const layers: NumpadLayers = { ...this.layersSubject.value };
    const layer: NumpadBindings = { ...(layers[layerId] ?? {}) };

    if (command.trim().length === 0) {
      delete layer[key];
    } else {
      layer[key] = command;
    }

    if (Object.keys(layer).length === 0) {
      delete layers[layerId];
    } else {
      layers[layerId] = layer;
    }

    this.layersSubject.next(layers);
    this.persist(layers);
  }

  /** Resets all layers to the built-in defaults. */
  public resetToDefaults(): void {
    const defaults = defaultLayers();
    this.layersSubject.next(defaults);
    this.persist(defaults);
  }

  /**
   * Sends the command bound to `key` in the layer for `mods` (default: the
   * no-modifier layer). No-op if unbound. Used by the on-screen keys.
   */
  public trigger(
    key: NumpadKey,
    mods: NumpadModifiers = { shift: false, ctrl: false, alt: false, meta: false },
  ): void {
    const command = this.getCommand(key, mods);
    if (command !== undefined && command.length > 0) {
      this.mudService.sendMessage(command);
    }
  }

  /**
   * Evaluates a physical key press: if it is a numpad key, resolves the bound
   * command for the effective layer and sends it. Returns the sent command (so
   * the caller can show feedback and `preventDefault()`), or `null` when the
   * key is not a numpad key or nothing is bound.
   *
   * `extraMods` are OR-ed with the event's physical modifiers — this is how the
   * numpad window's layer checkboxes and the held modifier keys resolve to the
   * SAME layer. Physical Ctrl+Alt alone is ignored (AltGr), matching u1.
   */
  public triggerFromEvent(
    event: KeyboardEvent,
    extraMods?: Partial<NumpadModifiers>,
  ): string | null {
    if (!isNumpadCode(event.code)) {
      return null;
    }

    // AltGr surfaces as physical Ctrl+Alt; ignore so it doesn't hijack typing.
    if (
      event.ctrlKey &&
      event.altKey &&
      !event.shiftKey &&
      !event.metaKey
    ) {
      return null;
    }

    const mods: NumpadModifiers = {
      shift: event.shiftKey || extraMods?.shift === true,
      ctrl: event.ctrlKey || extraMods?.ctrl === true,
      alt: event.altKey || extraMods?.alt === true,
      meta: event.metaKey || extraMods?.meta === true,
    };

    const command = this.getCommand(event.code, mods);
    if (command !== undefined && command.length > 0) {
      this.mudService.sendMessage(command);
      return command;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  private loadLayers(): NumpadLayers {
    try {
      const raw = namespacedStorage.get(STORAGE_SUFFIX);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        return this.normalizeLoaded(parsed);
      }
    } catch (error) {
      console.warn('[Numpad] Failed to load bindings from localStorage', error);
    }

    return defaultLayers();
  }

  /**
   * Accepts both the new layered layout and the legacy flat layout. A flat
   * layout (values are command strings) is migrated into the no-modifier
   * layer.
   */
  private normalizeLoaded(parsed: unknown): NumpadLayers {
    if (!parsed || typeof parsed !== 'object') {
      return defaultLayers();
    }

    const entries = Object.entries(parsed as Record<string, unknown>);
    if (entries.length === 0) {
      return defaultLayers();
    }

    // Legacy flat layout: at least one value is a command string.
    const isFlat = entries.some(([, value]) => typeof value === 'string');
    if (isFlat) {
      return { '': parsed as NumpadBindings };
    }

    // Already layered: keep only object-valued layers.
    const layers: NumpadLayers = {};
    for (const [layerId, value] of entries) {
      if (value && typeof value === 'object') {
        layers[layerId] = value as NumpadBindings;
      }
    }
    return layers;
  }

  private persist(layers: NumpadLayers): void {
    try {
      namespacedStorage.set(STORAGE_SUFFIX, JSON.stringify(layers));
    } catch (error) {
      console.warn('[Numpad] Failed to save bindings to localStorage', error);
    }
  }
}
