import { Injectable } from '@angular/core';

import { namespacedKey, namespacedStorage } from '../utils/storage-namespace';

// Secondary safety net. The entry-count cap below normally binds first; this
// only matters if individual chunks are unusually large.
const MAX_STORAGE_BYTES = 10 * 1024 * 1024; // 10MB
// Hard cap on the number of retained entries (ring buffer). Bounds both the
// in-memory footprint and the cost of replaying the backlog into xterm on a
// shell switch / navigation.
const MAX_ENTRIES = 4000;
// Coalesce writes: persist at most once per this window of quiet, instead of
// on every single server chunk. A burst of output therefore costs one write,
// not one-per-chunk.
const SAVE_DEBOUNCE_MS = 750;
const STORAGE_SUFFIX = 'webmud3-history';

export type HistoryEntry =
  | { type: 'server'; data: string; seq: number; sessionToken: string }
  | { type: 'input'; data: string };

type HistoryStore = {
  entries: HistoryEntry[];
  meta: {
    lastSeqSeenBySession: Record<string, number>;
  };
};

/**
 * Service for persisting MUD output history to localStorage.
 *
 * The store is loaded from localStorage exactly once (lazily) and then kept
 * in memory; all reads and appends operate on that in-memory copy. Writes back
 * to localStorage are debounced so a burst of server output costs a single
 * write rather than one full parse+serialize cycle per chunk — the latter grew
 * quadratically with the accumulated history and froze the client UI once the
 * backlog reached several pages.
 */
@Injectable({
  providedIn: 'root',
})
export class OutputHistoryService {
  // Authoritative in-memory copy. `null` until first access.
  private store: HistoryStore | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Flush any pending write before the page goes away (reload, navigation,
    // tab close) so the debounced buffer is never lost. `pagehide` fires more
    // reliably than `beforeunload` on mobile / bfcache.
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => this.flush());
    }
  }

  // Public API for structured history
  public loadEntries(): HistoryEntry[] {
    return this.ensureLoaded().entries;
  }

  public appendServerEntry(
    sessionToken: string,
    data: string,
    seq: number,
  ): void {
    const store = this.ensureLoaded();
    const last = store.meta.lastSeqSeenBySession[sessionToken] ?? 0;

    if (seq <= last) {
      // Duplicate or old entry; ignore
      return;
    }

    store.entries.push({ type: 'server', data, seq, sessionToken });
    store.meta.lastSeqSeenBySession[sessionToken] = seq;
    this.enforceEntryCap(store);
    this.scheduleSave();
  }

  public appendInputLine(line: string): void {
    const store = this.ensureLoaded();
    store.entries.push({ type: 'input', data: line });
    this.enforceEntryCap(store);
    this.scheduleSave();
  }

  public getLastSeqSeen(sessionToken: string): number {
    return this.ensureLoaded().meta.lastSeqSeenBySession[sessionToken] ?? 0;
  }

  public setLastSeqSeen(sessionToken: string, seq: number): void {
    const store = this.ensureLoaded();
    store.meta.lastSeqSeenBySession[sessionToken] = seq;
    this.scheduleSave();
  }

  public clearAll(): void {
    this.cancelPendingSave();
    this.store = { entries: [], meta: { lastSeqSeenBySession: {} } };
    if (!this.isStorageAvailable()) return;
    try {
      namespacedStorage.remove(STORAGE_SUFFIX);
      console.debug('[OutputHistory] Cleared all entries');
    } catch (error) {
      console.error('[OutputHistory] Failed to clear entries:', error);
    }
  }

  /**
   * Writes any pending in-memory changes to localStorage immediately and
   * cancels the debounce timer. Called on `pagehide` so nothing is lost when
   * the page is unloaded mid-debounce.
   */
  public flush(): void {
    if (this.saveTimer === null) {
      return;
    }
    this.cancelPendingSave();
    if (this.store) {
      this.saveStore(this.store);
    }
  }

  // Backward-compat wrappers (no-ops or adapters)
  public saveLines(_lines: string[]): void {
    // Deprecated: use structured API
    console.warn('[OutputHistory] saveLines is deprecated');
  }

  public loadLines(): string[] {
    // Map structured entries back to flat strings
    return this.loadEntries().map((e) => e.data);
  }

  public clearLines(): void {
    this.clearAll();
  }

  public appendLines(newLines: string[]): void {
    const store = this.ensureLoaded();
    for (const line of newLines) {
      store.entries.push({
        type: 'server',
        data: line,
        seq: 0,
        sessionToken: '',
      });
    }
    this.enforceEntryCap(store);
    this.scheduleSave();
  }

  /**
   * Drops the oldest entries once the ring buffer overflows. `meta` is left
   * intact so per-session seq de-duplication keeps working even after the
   * corresponding entries have been evicted.
   */
  private enforceEntryCap(store: HistoryStore): void {
    if (store.entries.length > MAX_ENTRIES) {
      store.entries.splice(0, store.entries.length - MAX_ENTRIES);
    }
  }

  /**
   * (Re)arms the debounced write. Coalesces a burst of appends into a single
   * localStorage write after the output goes quiet.
   */
  private scheduleSave(): void {
    if (this.saveTimer !== null) {
      return;
    }
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      if (this.store) {
        this.saveStore(this.store);
      }
    }, SAVE_DEBOUNCE_MS);
  }

  private cancelPendingSave(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  /**
   * Checks if localStorage is available.
   */
  private isStorageAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Trims entries to fit within the specified byte size.
   * Removes oldest entries (from the beginning) until size is acceptable.
   */
  private trimStoreToSize(store: HistoryStore, maxBytes: number): HistoryStore {
    let entries = [...store.entries];
    let serialized = JSON.stringify({ entries, meta: store.meta });
    let sizeBytes = new Blob([serialized]).size;

    while (entries.length > 0 && sizeBytes > maxBytes) {
      const removeCount = Math.max(1, Math.floor(entries.length * 0.1));
      entries = entries.slice(removeCount);
      serialized = JSON.stringify({ entries, meta: store.meta });
      sizeBytes = new Blob([serialized]).size;
    }

    console.debug(
      `[OutputHistory] Trimmed store to ${entries.length} entries (${sizeBytes} bytes)`,
    );
    return { entries, meta: store.meta };
  }

  /**
   * Handles QuotaExceededError by trimming entries and retrying.
   */
  private handleQuotaExceeded(store: HistoryStore): void {
    console.warn(
      '[OutputHistory] Quota exceeded, attempting to trim and retry',
    );
    const trimmedStore = this.trimStoreToSize(store, MAX_STORAGE_BYTES * 0.8); // Use 80% of limit
    try {
      localStorage.setItem(
        namespacedKey(STORAGE_SUFFIX),
        JSON.stringify(trimmedStore),
      );
      // Keep the in-memory copy consistent with what was actually persisted.
      this.store = trimmedStore;
      console.debug('[OutputHistory] Successfully saved after trimming');
    } catch (error) {
      console.error('[OutputHistory] Failed even after trimming:', error);
    }
  }

  /**
   * Returns the in-memory store, loading it from localStorage on first use.
   */
  private ensureLoaded(): HistoryStore {
    if (this.store === null) {
      this.store = this.loadStore();
      this.enforceEntryCap(this.store);
    }
    return this.store;
  }

  private loadStore(): HistoryStore {
    if (!this.isStorageAvailable()) {
      return { entries: [], meta: { lastSeqSeenBySession: {} } };
    }

    try {
      const stored = namespacedStorage.get(STORAGE_SUFFIX);
      if (!stored) {
        return { entries: [], meta: { lastSeqSeenBySession: {} } };
      }
      const parsed = JSON.parse(stored) as HistoryStore | string[];
      if (Array.isArray(parsed)) {
        // Migrate from legacy string[] format
        return {
          entries: parsed.map((data) => ({
            type: 'server',
            data,
            seq: 0,
            sessionToken: '',
          })),
          meta: { lastSeqSeenBySession: {} },
        };
      }
      return parsed;
    } catch (error) {
      console.error('[OutputHistory] Failed to load store:', error);
      return { entries: [], meta: { lastSeqSeenBySession: {} } };
    }
  }

  private saveStore(store: HistoryStore): void {
    if (!this.isStorageAvailable()) return;
    try {
      let toSave = store;
      const serialized = JSON.stringify(toSave);
      const sizeBytes = new Blob([serialized]).size;
      if (sizeBytes > MAX_STORAGE_BYTES) {
        console.warn('[OutputHistory] Store exceeds limit, trimming...');
        toSave = this.trimStoreToSize(store, MAX_STORAGE_BYTES);
        this.store = toSave;
      }
      localStorage.setItem(
        namespacedKey(STORAGE_SUFFIX),
        JSON.stringify(toSave),
      );
    } catch (error) {
      console.error('[OutputHistory] Failed to save store:', error);
      if (
        error instanceof DOMException &&
        error.name === 'QuotaExceededError'
      ) {
        this.handleQuotaExceeded(store);
      }
    }
  }
}
