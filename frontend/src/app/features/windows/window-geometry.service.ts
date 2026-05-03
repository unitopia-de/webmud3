import { Injectable } from '@angular/core';

import { namespacedStorage } from '@webmud3/frontend/shared/utils/storage-namespace';

const STORAGE_SUFFIX = 'webmud3-window-geometry';

/** A persisted window geometry: position + size in pixels. */
export type WindowGeometry = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type GeometryMap = Record<string, WindowGeometry>;

/** Minimum on-screen area required to consider a saved window "reachable". */
const MIN_VISIBLE_PX = 32;

/**
 * Persists per-window-type position and size in localStorage so that windows
 * reopen at their previous geometry across reloads.
 *
 * Each caller chooses its own opaque key (e.g. `inventory-window`, `editor:/path/to/file`).
 * Geometry is loaded once on construction and only re-persisted when callers
 * actually save (i.e. on window close), to keep localStorage churn low.
 *
 * Loaded values are clamped against the current viewport so that a window
 * saved on a larger screen never opens fully off-screen.
 */
@Injectable({ providedIn: 'root' })
export class WindowGeometryService {
  private cache: GeometryMap = {};

  constructor() {
    this.cache = this.readFromStorage();
  }

  /**
   * Returns the saved geometry for `key`, clamped to the current viewport, or
   * `null` if nothing is persisted for that key yet.
   */
  public load(key: string): WindowGeometry | null {
    const stored = this.cache[key];
    if (!stored) {
      return null;
    }

    return this.clampToViewport(stored);
  }

  /**
   * Persists the given geometry for `key`. No-op if values are non-positive
   * (e.g. width=0 means "auto" — there is nothing meaningful to save).
   */
  public save(key: string, geometry: WindowGeometry): void {
    if (geometry.w <= 0 || geometry.h <= 0) {
      return;
    }

    const next: WindowGeometry = {
      x: Math.round(geometry.x),
      y: Math.round(geometry.y),
      w: Math.round(geometry.w),
      h: Math.round(geometry.h),
    };

    const previous = this.cache[key];
    if (
      previous &&
      previous.x === next.x &&
      previous.y === next.y &&
      previous.w === next.w &&
      previous.h === next.h
    ) {
      return;
    }

    this.cache[key] = next;
    this.persist();
  }

  /** Drops the persisted geometry for `key`. */
  public clear(key: string): void {
    if (!(key in this.cache)) {
      return;
    }

    delete this.cache[key];
    this.persist();
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private clampToViewport(g: WindowGeometry): WindowGeometry {
    const vw = typeof window !== 'undefined' ? window.innerWidth : g.x + g.w;
    const vh = typeof window !== 'undefined' ? window.innerHeight : g.y + g.h;

    // Don't allow widgets larger than the viewport — they can't be moved back.
    const w = Math.min(g.w, vw);
    const h = Math.min(g.h, vh);

    // Keep at least MIN_VISIBLE_PX of the title bar reachable on each side.
    const maxX = vw - MIN_VISIBLE_PX;
    const maxY = vh - MIN_VISIBLE_PX;
    const minX = MIN_VISIBLE_PX - w;
    const minY = 0;

    const x = Math.max(minX, Math.min(g.x, maxX));
    const y = Math.max(minY, Math.min(g.y, maxY));

    return { x, y, w, h };
  }

  private readFromStorage(): GeometryMap {
    const raw = namespacedStorage.get(STORAGE_SUFFIX);
    if (!raw) {
      return {};
    }

    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const result: GeometryMap = {};
        for (const [key, value] of Object.entries(parsed)) {
          if (this.isValidGeometry(value)) {
            result[key] = value as WindowGeometry;
          }
        }
        return result;
      }
    } catch (err) {
      console.warn('[WindowGeometry] Failed to parse stored geometry', err);
    }

    return {};
  }

  private persist(): void {
    namespacedStorage.set(STORAGE_SUFFIX, JSON.stringify(this.cache));
  }

  private isValidGeometry(value: unknown): boolean {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const v = value as Record<string, unknown>;
    return (
      typeof v['x'] === 'number' &&
      typeof v['y'] === 'number' &&
      typeof v['w'] === 'number' &&
      typeof v['h'] === 'number'
    );
  }
}
