import { AnnounceQueue, SpeechPacing } from './mud-announce-queue';

/**
 * Steuerbares Pacing-Doppel: die Dauer hängt linear an der Textlänge
 * (10 ms je Zeichen), damit Erwartungen im Test exakt ausrechenbar sind.
 * Die Uhr wird — wie im echten Service — gegen `Date.now()` geführt, das die
 * Fake-Timer mitbewegen.
 */
class FakePacing implements SpeechPacing {
  public enabled = true;
  public msPerChar = 10;
  private busyUntil = 0;

  isEnabled(): boolean {
    return this.enabled;
  }

  estimateMs(text: string): number {
    return text.length * this.msPerChar;
  }

  remainingMs(): number {
    const left = this.busyUntil - Date.now();
    return left > 0 ? left : 0;
  }

  reserve(durationMs: number): void {
    if (!this.enabled || durationMs <= 0) return;
    const until = Date.now() + durationMs;
    if (until > this.busyUntil) this.busyUntil = until;
  }

  reset(): void {
    this.busyUntil = 0;
  }
}

describe('AnnounceQueue', () => {
  let write: jest.Mock<void, [string]>;
  let pacing: FakePacing;
  let queue: AnnounceQueue;

  /** Texte in der Reihenfolge, in der sie geschrieben wurden. */
  const written = (): string[] => write.mock.calls.map((c) => c[0]);

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T12:00:00Z'));
    write = jest.fn();
    pacing = new FakePacing();
    queue = new AnnounceQueue(write, pacing);
  });

  afterEach(() => {
    queue.reset();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Pacing aus', () => {
    beforeEach(() => (pacing.enabled = false));

    it('reicht jeden Eintrag sofort durch', () => {
      queue.push('eins');
      queue.push('zwei');

      expect(written()).toEqual(['eins', 'zwei']);
    });

    it('startet keinen einzigen Timer', () => {
      queue.push('eins');
      queue.push('zwei');

      expect(jest.getTimerCount()).toBe(0);
      expect(queue.isPending()).toBe(false);
    });
  });

  describe('Leerlauf-Regel', () => {
    it('schreibt den ersten Eintrag synchron, ohne Verzögerung', () => {
      queue.push('Hallo');

      expect(written()).toEqual(['Hallo']);
      expect(queue.isPending()).toBe(false);
    });

    it('schreibt auch später sofort, sobald die Uhr frei ist', () => {
      queue.push('abc'); // 30 ms
      jest.advanceTimersByTime(50);

      queue.push('def');
      expect(written()).toEqual(['abc', 'def']);
    });
  });

  describe('Reihenfolge und Wartezeit', () => {
    it('gibt den zweiten Eintrag erst nach der Dauer des ersten frei', () => {
      queue.push('abcde'); // 50 ms belegt
      queue.push('zweiter');

      expect(written()).toEqual(['abcde']);
      expect(queue.isPending()).toBe(true);

      jest.advanceTimersByTime(49);
      expect(written()).toEqual(['abcde']);

      jest.advanceTimersByTime(1);
      expect(written()).toEqual(['abcde', 'zweiter']);
    });

    it('hält die Reihenfolge über mehrere Einträge (FIFO)', () => {
      // Lange, nicht verschmelzbare Blöcke (je 100 Zeichen = 1000 ms).
      const a = 'a'.repeat(100);
      const b = 'b'.repeat(100);
      const c = 'c'.repeat(100);

      queue.push(a);
      queue.push(b);
      queue.push(c);

      jest.advanceTimersByTime(10_000);
      expect(written()).toEqual([a, b, c]);
    });

    it('ist nach dem letzten Eintrag nicht mehr pending', () => {
      queue.push('a'.repeat(100));
      queue.push('b'.repeat(100));

      jest.advanceTimersByTime(10_000);
      expect(queue.isPending()).toBe(false);
    });
  });

  describe('Verschmelzen', () => {
    it('fasst zwei kurze Einträge zu einem Schreibvorgang zusammen', () => {
      queue.push('a'.repeat(100)); // belegt die Uhr, geht sofort raus
      queue.push('kurz');
      queue.push('auch kurz');

      jest.advanceTimersByTime(10_000);

      // Erster Block, danach EIN verschmolzener Block.
      expect(write).toHaveBeenCalledTimes(2);
      expect(written()[1]).toBe('kurzauch kurz');
    });

    it('verschmilzt nicht über die Längengrenze hinweg', () => {
      queue.push('a'.repeat(100));
      queue.push('b'.repeat(50)); // 500 ms
      queue.push('c'.repeat(50)); // zusammen 1000 ms > 800 ms Grenze

      jest.advanceTimersByTime(10_000);
      expect(write).toHaveBeenCalledTimes(3);
    });
  });

  describe('Rückstau', () => {
    /** Wirft `n` nicht verschmelzbare Blöcke à ~1000 ms ein und leert die Queue. */
    const flood = (n: number, q: AnnounceQueue = queue): string[] => {
      for (let i = 0; i < n; i++) {
        q.push(`${i}-${'x'.repeat(100)}`);
      }
      jest.advanceTimersByTime(600_000);
      return written();
    };

    const skippedCount = (out: string[]): number => {
      const notice = out.find((t) => t.includes('übersprungen'));
      if (!notice) return 0;
      return Number(/(\d+) Meldung/.exec(notice)![1]);
    };

    it('kappt die Warteschlange und sagt die Zahl der Verworfenen an', () => {
      const out = flood(40);

      expect(out.some((t) => t.includes('übersprungen'))).toBe(true);

      // Die neuesten beiden Blöcke haben den Überlauf überlebt.
      expect(out[out.length - 1]).toContain('39-');
      expect(out[out.length - 2]).toContain('38-');
      expect(write.mock.calls.length).toBeLessThan(40);
    });

    it('verliert keine Meldung unbemerkt: geschrieben + übersprungen = eingeworfen', () => {
      const out = flood(40);

      const bloecke = out.filter((t) => !t.includes('übersprungen')).length;
      expect(bloecke + skippedCount(out)).toBe(40);
    });

    it('kumuliert mehrere Überläufe in EINEN Platzhalter', () => {
      const out = flood(60);

      expect(out.filter((t) => t.includes('übersprungen'))).toHaveLength(1);
    });

    it('zählt bei mehr Ausgabe mehr Übersprungenes', () => {
      // Zwei unabhängige Läufe: mehr Einwürfe ⇒ höherer Zähler im EINEN
      // Platzhalter (statt mehrerer Platzhalter).
      const laufe = (n: number): number => {
        const w = jest.fn<void, [string]>();
        const q = new AnnounceQueue(w, new FakePacing());
        for (let i = 0; i < n; i++) {
          q.push(`${i}-${'x'.repeat(100)}`);
        }
        jest.advanceTimersByTime(600_000);
        return skippedCount(w.mock.calls.map((c) => c[0]));
      };

      expect(laufe(60)).toBeGreaterThan(laufe(40));
    });

    it('formuliert den Einzelfall im Singular', () => {
      // Genau ein Verwurf: MAX_QUEUE_MS (20 s) mit drei 10-s-Blöcken reißen.
      const block = 'y'.repeat(1000); // 10_000 ms
      queue.push(block); // geht sofort raus
      queue.push(`1${block}`);
      queue.push(`2${block}`);
      queue.push(`3${block}`); // erzwingt genau einen Verwurf

      jest.advanceTimersByTime(600_000);

      const notice = written().find((t) => t.includes('übersprungen'));
      expect(notice).toBe('1 Meldung übersprungen.\n');
    });
  });

  describe('reset', () => {
    it('verwirft Wartendes, stoppt Timer und gibt die Uhr frei', () => {
      queue.push('a'.repeat(100));
      queue.push('b'.repeat(100));
      write.mockClear();

      queue.reset();

      expect(queue.isPending()).toBe(false);
      expect(jest.getTimerCount()).toBe(0);
      expect(pacing.remainingMs()).toBe(0);

      jest.advanceTimersByTime(60_000);
      expect(write).not.toHaveBeenCalled();
    });

    it('schreibt danach wieder sofort', () => {
      queue.push('a'.repeat(100));
      queue.push('b'.repeat(100));
      queue.reset();
      write.mockClear();

      queue.push('neu');
      expect(written()).toEqual(['neu']);
    });
  });

  it('ignoriert leeren Text', () => {
    queue.push('');

    expect(write).not.toHaveBeenCalled();
    expect(queue.isPending()).toBe(false);
  });
});
