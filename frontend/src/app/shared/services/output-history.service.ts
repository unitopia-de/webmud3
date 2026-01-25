import { Injectable } from '@angular/core';

const MAX_STORAGE_BYTES = 30 * 1024 * 1024; // 30MB
const STORAGE_KEY = 'webmud3-history';

/**
 * Service for persisting MUD output history to localStorage.
 * Stores output as a simple string array.
 */
@Injectable({
  providedIn: 'root',
})
export class OutputHistoryService {
  /**
   * Saves output lines to localStorage.
   * Enforces a ~30MB limit by removing oldest lines if needed.
   */
  public saveLines(lines: string[]): void {
    if (!this.isStorageAvailable()) {
      console.warn('[OutputHistory] localStorage not available');
      return;
    }

    try {
      const serialized = JSON.stringify(lines);

      // Check size limit
      const sizeBytes = new Blob([serialized]).size;
      if (sizeBytes > MAX_STORAGE_BYTES) {
        console.warn(
          `[OutputHistory] Data exceeds ${MAX_STORAGE_BYTES} bytes, trimming...`,
        );
        const trimmedLines = this.trimToSize(lines, MAX_STORAGE_BYTES);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedLines));
      } else {
        localStorage.setItem(STORAGE_KEY, serialized);
      }

      console.debug(
        `[OutputHistory] Saved ${lines.length} lines (${sizeBytes} bytes)`,
      );
    } catch (error) {
      console.error('[OutputHistory] Failed to save lines:', error);
      // If QuotaExceededError, try to trim
      if (
        error instanceof DOMException &&
        error.name === 'QuotaExceededError'
      ) {
        this.handleQuotaExceeded(lines);
      }
    }
  }

  /**
   * Loads output lines from localStorage.
   * Returns an empty array if no data exists or an error occurs.
   */
  public loadLines(): string[] {
    if (!this.isStorageAvailable()) {
      return [];
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (!stored) {
        console.debug('[OutputHistory] No stored lines found');
        return [];
      }

      const lines = JSON.parse(stored) as string[];
      console.debug(`[OutputHistory] Loaded ${lines.length} lines`);
      return lines;
    } catch (error) {
      console.error('[OutputHistory] Failed to load lines:', error);
      return [];
    }
  }

  /**
   * Clears all stored output lines.
   */
  public clearLines(): void {
    if (!this.isStorageAvailable()) {
      return;
    }

    try {
      localStorage.removeItem(STORAGE_KEY);
      console.debug('[OutputHistory] Cleared all lines');
    } catch (error) {
      console.error('[OutputHistory] Failed to clear lines:', error);
    }
  }

  /**
   * Appends new lines to existing stored lines.
   */
  public appendLines(newLines: string[]): void {
    const existingLines = this.loadLines();
    const combinedLines = [...existingLines, ...newLines];
    this.saveLines(combinedLines);
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
  private trimToSize(lines: string[], maxBytes: number): string[] {
    let trimmedLines = [...lines];

    while (trimmedLines.length > 0) {
      const serialized = JSON.stringify(trimmedLines);
      const sizeBytes = new Blob([serialized]).size;

      if (sizeBytes <= maxBytes) {
        break;
      }

      // Remove oldest 10% of lines at a time for efficiency
      const removeCount = Math.max(1, Math.floor(trimmedLines.length * 0.1));
      trimmedLines = trimmedLines.slice(removeCount);
    }

    console.debug(
      `[OutputHistory] Trimmed from ${lines.length} to ${trimmedLines.length} lines`,
    );
    return trimmedLines;
  }

  /**
   * Handles QuotaExceededError by trimming lines and retrying.
   */
  private handleQuotaExceeded(lines: string[]): void {
    console.warn(
      '[OutputHistory] Quota exceeded, attempting to trim and retry',
    );
    const trimmedLines = this.trimToSize(lines, MAX_STORAGE_BYTES * 0.8); // Use 80% of limit
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedLines));
      console.debug('[OutputHistory] Successfully saved after trimming');
    } catch (error) {
      console.error('[OutputHistory] Failed even after trimming:', error);
    }
  }
}
