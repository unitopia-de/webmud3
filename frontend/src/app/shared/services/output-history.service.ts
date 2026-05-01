import { Injectable } from '@angular/core';

import { namespacedKey, namespacedStorage } from '../utils/storage-namespace';

const MAX_STORAGE_BYTES = 30 * 1024 * 1024; // 30MB
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
 * Stores output as a simple string array.
 */
@Injectable({
  providedIn: 'root',
})
export class OutputHistoryService {
  // Public API for structured history
  public loadEntries(): HistoryEntry[] {
    const store = this.loadStore();
    return store.entries;
  }

  public appendServerEntry(
    sessionToken: string,
    data: string,
    seq: number,
  ): void {
    const store = this.loadStore();
    const last = store.meta.lastSeqSeenBySession[sessionToken] ?? 0;

    if (seq <= last) {
      // Duplicate or old entry; ignore
      return;
    }

    store.entries.push({ type: 'server', data, seq, sessionToken });
    store.meta.lastSeqSeenBySession[sessionToken] = seq;
    this.saveStore(store);
  }

  public appendInputLine(line: string): void {
    const store = this.loadStore();
    store.entries.push({ type: 'input', data: line });
    this.saveStore(store);
  }

  public getLastSeqSeen(sessionToken: string): number {
    const store = this.loadStore();
    return store.meta.lastSeqSeenBySession[sessionToken] ?? 0;
  }

  public setLastSeqSeen(sessionToken: string, seq: number): void {
    const store = this.loadStore();
    store.meta.lastSeqSeenBySession[sessionToken] = seq;
    this.saveStore(store);
  }

  public clearAll(): void {
    if (!this.isStorageAvailable()) return;
    try {
      namespacedStorage.remove(STORAGE_SUFFIX);
      console.debug('[OutputHistory] Cleared all entries');
    } catch (error) {
      console.error('[OutputHistory] Failed to clear entries:', error);
    }
  }

  // Backward-compat wrappers (no-ops or adapters)
  public saveLines(_lines: string[]): void {
    // Deprecated: use structured API
    console.warn('[OutputHistory] saveLines is deprecated');
  }

  public loadLines(): string[] {
    // Map structured entries back to flat strings
    const entries = this.loadEntries();
    return entries.map((e) => e.data);
  }

  public clearLines(): void {
    this.clearAll();
  }

  public appendLines(newLines: string[]): void {
    const store = this.loadStore();
    for (const line of newLines) {
      store.entries.push({
        type: 'server',
        data: line,
        seq: 0,
        sessionToken: '',
      });
    }
    this.saveStore(store);
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
   * Trims lines array to fit within the specified byte size.
   * Removes oldest lines (from the beginning) until size is acceptable.
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
   * Handles QuotaExceededError by trimming lines and retrying.
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
      console.debug('[OutputHistory] Successfully saved after trimming');
    } catch (error) {
      console.error('[OutputHistory] Failed even after trimming:', error);
    }
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
