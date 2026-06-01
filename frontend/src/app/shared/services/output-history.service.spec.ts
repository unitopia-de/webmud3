import { namespacedKey } from '../utils/storage-namespace';
import { OutputHistoryService } from './output-history.service';

const HISTORY_KEY = namespacedKey('webmud3-history');
const SAVE_DEBOUNCE_MS = 750;
const MAX_ENTRIES = 4000;

/** Counts localStorage writes that target the history key (ignores the
 *  internal `__storage_test__` availability probe). */
function countHistoryWrites(spy: jest.SpyInstance): number {
  return spy.mock.calls.filter((call) => call[0] === HISTORY_KEY).length;
}

describe('OutputHistoryService', () => {
  let service: OutputHistoryService;
  let setItemSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
    setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
    service = new OutputHistoryService();
  });

  afterEach(() => {
    setItemSpy.mockRestore();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('debounced persistence', () => {
    it('does not write to localStorage immediately on append', () => {
      service.appendServerEntry('sess', 'hello', 1);

      expect(countHistoryWrites(setItemSpy)).toBe(0);
      // ...but the in-memory copy is already up to date.
      expect(service.loadEntries()).toHaveLength(1);
    });

    it('coalesces a burst of appends into a single write', () => {
      for (let i = 1; i <= 10; i++) {
        service.appendServerEntry('sess', `line ${i}`, i);
      }

      expect(countHistoryWrites(setItemSpy)).toBe(0);

      jest.advanceTimersByTime(SAVE_DEBOUNCE_MS);

      expect(countHistoryWrites(setItemSpy)).toBe(1);
    });

    it('persists the entries so a fresh service instance can read them back', () => {
      service.appendServerEntry('sess', 'persisted', 1);
      service.appendInputLine('typed\r\n');
      jest.advanceTimersByTime(SAVE_DEBOUNCE_MS);

      const reloaded = new OutputHistoryService();
      const entries = reloaded.loadEntries();

      expect(entries).toHaveLength(2);
      expect(entries[0]).toMatchObject({ type: 'server', data: 'persisted' });
      expect(entries[1]).toMatchObject({ type: 'input', data: 'typed\r\n' });
    });
  });

  describe('flush', () => {
    it('writes pending changes immediately and cancels the debounce', () => {
      service.appendServerEntry('sess', 'flush me', 1);
      expect(countHistoryWrites(setItemSpy)).toBe(0);

      service.flush();

      expect(countHistoryWrites(setItemSpy)).toBe(1);

      // No second write once the (now cancelled) timer would have fired.
      jest.advanceTimersByTime(SAVE_DEBOUNCE_MS);
      expect(countHistoryWrites(setItemSpy)).toBe(1);
    });

    it('is a no-op when there is nothing pending', () => {
      service.flush();
      expect(countHistoryWrites(setItemSpy)).toBe(0);
    });
  });

  describe('seq gating', () => {
    it('ignores duplicate or out-of-order server entries', () => {
      service.appendServerEntry('sess', 'first', 5);
      service.appendServerEntry('sess', 'older', 3); // <= last, dropped
      service.appendServerEntry('sess', 'same', 5); // == last, dropped
      service.appendServerEntry('sess', 'newer', 6);

      const data = service.loadEntries().map((e) => e.data);
      expect(data).toEqual(['first', 'newer']);
      expect(service.getLastSeqSeen('sess')).toBe(6);
    });

    it('tracks last-seen seq independently per session', () => {
      service.appendServerEntry('a', 'a1', 10);
      service.appendServerEntry('b', 'b1', 2);

      expect(service.getLastSeqSeen('a')).toBe(10);
      expect(service.getLastSeqSeen('b')).toBe(2);
    });
  });

  describe('ring-buffer cap', () => {
    it('keeps at most MAX_ENTRIES entries, dropping the oldest', () => {
      for (let seq = 1; seq <= MAX_ENTRIES + 1; seq++) {
        service.appendServerEntry('sess', `line ${seq}`, seq);
      }

      const entries = service.loadEntries();
      expect(entries).toHaveLength(MAX_ENTRIES);
      // Oldest (seq 1) was evicted; first retained entry is seq 2.
      expect(entries[0]).toMatchObject({ data: 'line 2' });
      expect(entries[entries.length - 1]).toMatchObject({
        data: `line ${MAX_ENTRIES + 1}`,
      });
    });

    it('preserves seq de-duplication after eviction', () => {
      for (let seq = 1; seq <= MAX_ENTRIES + 1; seq++) {
        service.appendServerEntry('sess', `line ${seq}`, seq);
      }

      // A replayed old seq must still be dropped even though its entry is gone.
      service.appendServerEntry('sess', 'replayed', 100);

      expect(service.loadEntries()).toHaveLength(MAX_ENTRIES);
      expect(service.getLastSeqSeen('sess')).toBe(MAX_ENTRIES + 1);
    });
  });

  describe('clearAll', () => {
    it('empties the store, removes the key and cancels pending writes', () => {
      service.appendServerEntry('sess', 'to be cleared', 1);

      const removeSpy = jest.spyOn(Storage.prototype, 'removeItem');
      service.clearAll();

      expect(service.loadEntries()).toHaveLength(0);
      expect(removeSpy).toHaveBeenCalledWith(HISTORY_KEY);

      // The earlier append's debounced write must not resurrect the data.
      jest.advanceTimersByTime(SAVE_DEBOUNCE_MS);
      expect(countHistoryWrites(setItemSpy)).toBe(0);

      removeSpy.mockRestore();
    });
  });
});
