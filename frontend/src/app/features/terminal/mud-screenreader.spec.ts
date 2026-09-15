import { MudScreenReaderAnnouncer, OutputVerbosity } from './mud-screenreader';
import { SpeechPacingService } from './speech-pacing.service';

describe('MudScreenReaderAnnouncer', () => {
  let liveRegion: HTMLElement;
  let announcer: MudScreenReaderAnnouncer;

  beforeEach(() => {
    liveRegion = document.createElement('div');
    announcer = new MudScreenReaderAnnouncer(liveRegion);
  });

  afterEach(() => {
    announcer.dispose();
  });

  it('announces sanitized text by appending to the live region', () => {
    announcer.announce('Hello \x1b[31mWorld\x1b[0m\r\n');

    expect(liveRegion.textContent).toBe('Hello World\n');
  });

  it('ignores announcements older than the current session', () => {
    const now = Date.now();
    const earlier = now - 500;

    announcer.markSessionStart(now);
    announcer.announce('Old content', earlier);

    expect(liveRegion.textContent).toBe('');
  });

  it('clear() empties the live region immediately', () => {
    announcer.announce('Message');
    expect(liveRegion.textContent).toBe('Message\n');

    announcer.clear();
    expect(liveRegion.textContent).toBe('');
  });

  it('stopAnnouncements() clears live region and backlog', () => {
    announcer.announce('First');
    announcer.announce('Second');

    expect(liveRegion.textContent).toBe('First\nSecond\n');

    announcer.stopAnnouncements();
    expect(liveRegion.textContent).toBe('');
  });

  it('ignores empty output after normalization', () => {
    announcer.announce('\x1b[31m\x1b[0m');

    expect(liveRegion.textContent).toBe('');
  });

  it('does NOT auto-clear the live region after announcing', () => {
    // Auto-clearing within ~2s breaks NVDA/JAWS on Windows — the screen
    // reader notices the change but the content is gone before it reads it.
    // Stale content is drained on session start / explicit clear instead.
    jest.useFakeTimers();
    try {
      announcer.announce('First');
      announcer.announce('Second');
      jest.advanceTimersByTime(10_000);

      expect(liveRegion.textContent).toBe('First\nSecond\n');
    } finally {
      jest.useRealTimers();
    }
  });

  it('caps the live region at 500 nodes and keeps the most recent', () => {
    const MAX = 500;
    for (let i = 1; i <= MAX + 80; i++) {
      announcer.announce(`Msg ${i}`);
    }

    expect(liveRegion.childNodes.length).toBe(MAX);
    // Oldest 80 dropped; newest stays so the SR never loses pending text.
    expect(liveRegion.firstChild?.textContent).toBe('Msg 81\n');
    expect(liveRegion.lastChild?.textContent).toBe(`Msg ${MAX + 80}\n`);
  });
});

describe('MudScreenReaderAnnouncer - appendToHistory', () => {
  let historyRegion: HTMLElement;
  let announcer: MudScreenReaderAnnouncer;

  beforeEach(() => {
    historyRegion = document.createElement('div');
    announcer = new MudScreenReaderAnnouncer(
      document.createElement('div'),
      historyRegion,
    );
  });

  afterEach(() => {
    announcer.dispose();
  });

  it('splits multiline output into separate log items', () => {
    announcer.appendToHistory('Line 1\nLine 2\nLine 3');

    const items = historyRegion.querySelectorAll('p.sr-log-item');
    expect(items.length).toBe(3);
    expect(items[0].textContent).toBe('Line 1');
    expect(items[1].textContent).toBe('Line 2');
    expect(items[2].textContent).toBe('Line 3');
  });

  it('skips empty lines', () => {
    announcer.appendToHistory('Line 1\n\nLine 3\n');

    const items = historyRegion.querySelectorAll('p.sr-log-item');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toBe('Line 1');
    expect(items[1].textContent).toBe('Line 3');
  });

  it('skips lines with only whitespace', () => {
    announcer.appendToHistory('Line 1\n   \n\t\nLine 4');

    const items = historyRegion.querySelectorAll('p.sr-log-item');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toBe('Line 1');
    expect(items[1].textContent).toBe('Line 4');
  });

  it('handles CRLF line endings correctly', () => {
    announcer.appendToHistory('Line 1\r\nLine 2\r\nLine 3');

    const items = historyRegion.querySelectorAll('p.sr-log-item');
    expect(items.length).toBe(3);
    expect(items[0].textContent).toBe('Line 1');
    expect(items[1].textContent).toBe('Line 2');
    expect(items[2].textContent).toBe('Line 3');
  });

  it('strips ANSI escape sequences from each line', () => {
    announcer.appendToHistory(
      'Line 1 \x1b[31mRed\x1b[0m\nLine 2 \x1b[32mGreen\x1b[0m',
    );

    const items = historyRegion.querySelectorAll('p.sr-log-item');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toBe('Line 1 Red');
    expect(items[1].textContent).toBe('Line 2 Green');
  });

  it('sets role="text" on each log item', () => {
    announcer.appendToHistory('Line 1\nLine 2');

    const items = historyRegion.querySelectorAll('p.sr-log-item');
    expect(items[0].getAttribute('role')).toBe('text');
    expect(items[1].getAttribute('role')).toBe('text');
  });

  it('ignores empty normalized output', () => {
    announcer.appendToHistory('\x1b[31m\x1b[0m\r\n\x1b[32m\x1b[0m');

    const items = historyRegion.querySelectorAll('p.sr-log-item');
    expect(items.length).toBe(0);
  });

  it('does nothing when history region is not provided', () => {
    const announcer2 = new MudScreenReaderAnnouncer(
      document.createElement('div'),
      undefined, // no history region
    );

    // Should not throw
    announcer2.appendToHistory('Line 1\nLine 2');
  });

  it('collapses excessive blank lines before splitting', () => {
    announcer.appendToHistory('Line 1\n\n\n\nLine 5');

    const items = historyRegion.querySelectorAll('p.sr-log-item');
    // Should be 3 items: 'Line 1', '', 'Line 5' -> after filtering empty: 2 items
    expect(items.length).toBe(2);
    expect(items[0].textContent).toBe('Line 1');
    expect(items[1].textContent).toBe('Line 5');
  });

  it('caps the history at 2000 items and keeps the most recent lines', () => {
    const MAX = 2000;
    // Feed more lines than the cap, in several chunks like real output.
    for (let i = 1; i <= MAX + 150; i++) {
      announcer.appendToHistory(`Line ${i}\n`);
    }

    const items = historyRegion.querySelectorAll('p.sr-log-item');
    expect(items.length).toBe(MAX);
    // Oldest 150 were evicted; the window is the most recent MAX lines.
    expect(items[0].textContent).toBe('Line 151');
    expect(items[items.length - 1].textContent).toBe(`Line ${MAX + 150}`);
  });

  it('also enforces the cap when a single chunk overflows it', () => {
    const MAX = 2000;
    const lines = Array.from({ length: MAX + 50 }, (_, i) => `L${i + 1}`);
    announcer.appendToHistory(lines.join('\n'));

    const items = historyRegion.querySelectorAll('p.sr-log-item');
    expect(items.length).toBe(MAX);
    expect(items[0].textContent).toBe('L51');
    expect(items[items.length - 1].textContent).toBe(`L${MAX + 50}`);
  });
});

describe('MudScreenReaderAnnouncer - announceInput', () => {
  let inputRegion: HTMLElement;
  let announcer: MudScreenReaderAnnouncer;

  beforeEach(() => {
    inputRegion = document.createElement('div');
    announcer = new MudScreenReaderAnnouncer(
      document.createElement('div'),
      document.createElement('div'),
      () => false,
      inputRegion,
    );
  });

  afterEach(() => {
    announcer.dispose();
  });

  it('does not write to the input region while typing a single word', () => {
    announcer.announceInput('h');
    announcer.announceInput('ha');
    announcer.announceInput('hal');
    announcer.announceInput('hall');
    announcer.announceInput('hallo');

    expect(inputRegion.textContent).toBe('');
  });

  it('writes the completed word into the input region on whitespace', () => {
    announcer.announceInput('h');
    announcer.announceInput('ha');
    announcer.announceInput('hal');
    announcer.announceInput('hall');
    announcer.announceInput('hallo');
    announcer.announceInput('hallo ');

    expect(inputRegion.textContent).toBe('hallo');
  });

  it('writes each newly completed word as the user keeps typing', () => {
    announcer.announceInput('schau');
    announcer.announceInput('schau ');
    expect(inputRegion.textContent).toBe('schau');

    announcer.announceInput('schau n');
    announcer.announceInput('schau na');
    announcer.announceInput('schau nach');
    announcer.announceInput('schau nach ');
    expect(inputRegion.textContent).toBe('nach');
  });

  it('stays silent on backspace (textarea echo handles it)', () => {
    announcer.announceInput('hallo');
    announcer.announceInput('hallo ');
    expect(inputRegion.textContent).toBe('hallo');

    announcer.announceInput('hallo');
    // The input region still shows the previous word — backspace does not
    // overwrite it. The auto-clearing live region drains it.
    expect(inputRegion.textContent).toBe('hallo');
  });

  it('does nothing when input region is not provided', () => {
    const announcer2 = new MudScreenReaderAnnouncer(
      document.createElement('div'),
      document.createElement('div'),
      () => false,
      undefined,
    );

    // Should not throw
    announcer2.announceInput('hallo ');
  });
});

describe('MudScreenReaderAnnouncer - announceInputCommitted', () => {
  let inputRegion: HTMLElement;
  let announcer: MudScreenReaderAnnouncer;

  beforeEach(() => {
    inputRegion = document.createElement('div');
    announcer = new MudScreenReaderAnnouncer(
      document.createElement('div'),
      document.createElement('div'),
      () => false,
      inputRegion,
    );
  });

  afterEach(() => {
    announcer.dispose();
  });

  it('writes only the tail word of a multi-word command', () => {
    // The earlier words ("betrachte") were already spoken by announceInput
    // when the user typed the space — reading the whole line would echo
    // them a second time. Only the trailing "mich" is new.
    announcer.announceInputCommitted('betrachte mich');

    expect(inputRegion.textContent).toBe('mich');
  });

  it('writes the whole input for a single-word command', () => {
    // No whitespace → the whole input is the "tail word", so it's spoken
    // in full. Without this fallback, "schau" + Enter would announce nothing.
    announcer.announceInputCommitted('schau');

    expect(inputRegion.textContent).toBe('schau');
  });

  it('strips ANSI escape sequences from the announced tail word', () => {
    announcer.announceInputCommitted('hallo \x1b[31mwelt\x1b[0m');

    expect(inputRegion.textContent).toBe('welt');
  });

  it('says nothing if the buffer ends in whitespace', () => {
    // Trailing whitespace means announceInput already spoke the last word
    // when the user typed the space — committing now would be a duplicate.
    announcer.announceInputCommitted('hallo welt ');

    expect(inputRegion.textContent).toBe('');
  });

  it('ignores empty input after normalization', () => {
    announcer.announceInputCommitted('   ');

    expect(inputRegion.textContent).toBe('');
  });

  it('clears the input region 700ms after a commit', () => {
    jest.useFakeTimers();
    try {
      announcer.announceInputCommitted('betrachte mich');
      expect(inputRegion.textContent).toBe('mich');

      jest.advanceTimersByTime(699);
      expect(inputRegion.textContent).toBe('mich');

      jest.advanceTimersByTime(2);
      expect(inputRegion.textContent).toBe('');
    } finally {
      jest.useRealTimers();
    }
  });

  it('does nothing when input region is not provided', () => {
    const announcer2 = new MudScreenReaderAnnouncer(
      document.createElement('div'),
      document.createElement('div'),
      () => false,
      undefined,
    );

    // Should not throw
    announcer2.announceInputCommitted('betrachte mich');
  });

  it('resets the per-word buffer tracker after commit', () => {
    // Type a word, commit, then type the same prefix again — the new prefix
    // must not be treated as a continuation of the previous buffer.
    announcer.announceInput('hallo');
    announcer.announceInputCommitted('hallo');

    // After commit the auto-clear timer will fire later; for this test we
    // care that the very next character behaves as if the buffer started
    // fresh (no spurious word boundary).
    announcer.announceInput('h');
    announcer.announceInput('ha');
    // Still typing — no whitespace yet, region content is whatever the
    // commit left there (cleared after the timeout in the real flow).
    // Important: announceInput must not crash because lastAnnouncedBuffer
    // was reset on commit.
    expect(() => announcer.announceInput('hal')).not.toThrow();
  });
});

describe('MudScreenReaderAnnouncer - quiet verbosity', () => {
  let liveRegion: HTMLElement;
  let historyRegion: HTMLElement;
  let level: OutputVerbosity;
  let announcer: MudScreenReaderAnnouncer;

  beforeEach(() => {
    jest.useFakeTimers();
    liveRegion = document.createElement('div');
    historyRegion = document.createElement('div');
    level = 'quiet';
    announcer = new MudScreenReaderAnnouncer(
      liveRegion,
      historyRegion,
      () => false,
      undefined,
      () => level,
    );
  });

  afterEach(() => {
    announcer.dispose();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('coalesces several announcements into ONE live-region node per window', () => {
    announcer.announce('First');
    announcer.announce('Second');
    announcer.announce('Third');

    // Nothing flushed yet — still inside the coalesce window.
    expect(liveRegion.childNodes.length).toBe(0);

    jest.advanceTimersByTime(200);

    // One combined node instead of three.
    expect(liveRegion.childNodes.length).toBe(1);
    expect(liveRegion.textContent).toBe('First\nSecond\nThird\n');
  });

  it('replaces the live region each flush so it never accumulates (no re-read)', () => {
    for (let i = 1; i <= 80; i++) {
      announcer.announce(`Msg ${i}`);
      jest.advanceTimersByTime(200);
    }
    // Replace pattern: exactly one node, holding only the latest block — this
    // is what prevents iOS VoiceOver from re-reading earlier output.
    expect(liveRegion.childNodes.length).toBe(1);
    expect(liveRegion.textContent).toBe('Msg 80\n');
  });

  it('coalesces history appends into one DOM flush per window (quiet)', () => {
    announcer.appendToHistory('Alpha\n');
    announcer.appendToHistory('Beta\n');
    // Nothing inserted yet — still inside the coalesce window.
    expect(historyRegion.querySelectorAll('p.sr-log-item').length).toBe(0);

    jest.advanceTimersByTime(200);

    const items = historyRegion.querySelectorAll('p.sr-log-item');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toBe('Alpha');
    expect(items[1].textContent).toBe('Beta');
  });

  it('uses the smaller quiet history cap (200)', () => {
    for (let i = 1; i <= 250; i++) {
      announcer.appendToHistory(`Line ${i}\n`);
    }
    jest.advanceTimersByTime(200); // flush the coalesced buffer
    const items = historyRegion.querySelectorAll('p.sr-log-item');
    expect(items.length).toBe(200);
    expect(items[items.length - 1].textContent).toBe('Line 250');
  });

  it('drops pending coalesced history on session start', () => {
    announcer.appendToHistory('Old session line\n');
    announcer.markSessionStart();
    jest.advanceTimersByTime(200);
    // The buffered line belonged to the old session and must not surface.
    expect(historyRegion.querySelectorAll('p.sr-log-item').length).toBe(0);
  });

  it('drops pending coalesced text on clear / session start', () => {
    announcer.announce('Buffered');
    expect(liveRegion.childNodes.length).toBe(0);

    announcer.markSessionStart();
    jest.advanceTimersByTime(200);

    // The buffered text belonged to the old session and must not surface.
    expect(liveRegion.childNodes.length).toBe(0);
    expect(liveRegion.textContent).toBe('');
  });
});

describe('MudScreenReaderAnnouncer - normal verbosity', () => {
  let liveRegion: HTMLElement;
  let historyRegion: HTMLElement;
  let announcer: MudScreenReaderAnnouncer;

  beforeEach(() => {
    jest.useFakeTimers();
    liveRegion = document.createElement('div');
    historyRegion = document.createElement('div');
    announcer = new MudScreenReaderAnnouncer(
      liveRegion,
      historyRegion,
      () => false,
      undefined,
      () => 'normal' as OutputVerbosity,
    );
  });

  afterEach(() => {
    announcer.dispose();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('coalesces a burst into one node but APPENDS across windows (additions kept)', () => {
    announcer.announce('A');
    announcer.announce('B');
    jest.advanceTimersByTime(120);
    // First window → one combined, APPENDED element node.
    expect(liveRegion.childNodes.length).toBe(1);
    expect(liveRegion.children[0].tagName).toBe('DIV');
    expect(liveRegion.textContent).toBe('A\nB\n');

    announcer.announce('C');
    jest.advanceTimersByTime(120);
    // Second window appends a SECOND node (unlike quiet's single-node replace).
    expect(liveRegion.childNodes.length).toBe(2);
    expect(liveRegion.textContent).toBe('A\nB\nC\n');
  });

  it('uses the medium history cap (1200)', () => {
    for (let i = 1; i <= 1250; i++) {
      announcer.appendToHistory(`Line ${i}\n`);
    }
    const items = historyRegion.querySelectorAll('p.sr-log-item');
    expect(items.length).toBe(1200);
    expect(items[items.length - 1].textContent).toBe('Line 1250');
  });
});

describe('MudScreenReaderAnnouncer - chatty verbosity (default)', () => {
  let liveRegion: HTMLElement;
  let announcer: MudScreenReaderAnnouncer;

  beforeEach(() => {
    liveRegion = document.createElement('div');
    // No 5th arg → defaults to 'chatty' (today's NVDA/JAWS behaviour).
    announcer = new MudScreenReaderAnnouncer(liveRegion);
  });

  afterEach(() => announcer.dispose());

  it('appends one node per chunk immediately, without coalescing', () => {
    announcer.announce('First');
    announcer.announce('Second');
    // No timer wait needed — chatty flushes synchronously, one node each.
    expect(liveRegion.childNodes.length).toBe(2);
    expect(liveRegion.textContent).toBe('First\nSecond\n');
  });

  it('wraps each addition in its own ELEMENT node (Phase 2b, for JAWS)', () => {
    announcer.announce('First');
    announcer.announce('Second');
    // Discrete element children — NOT bare text nodes — so JAWS announces only
    // the newly added block instead of re-reading the whole region.
    expect(liveRegion.children.length).toBe(2);
    expect(liveRegion.children[0].tagName).toBe('DIV');
    expect(liveRegion.children[1].textContent).toBe('Second\n');
  });
});

describe('MudScreenReaderAnnouncer - „Ausreden lassen"', () => {
  let liveRegion: HTMLElement;
  let historyRegion: HTMLElement;
  let level: OutputVerbosity;
  let pacing: FakePacing;
  let announcer: MudScreenReaderAnnouncer;

  /**
   * Sprech-Uhr-Doppel mit linearer Dauer (10 ms je Zeichen), damit die
   * erwarteten Wartezeiten exakt ausrechenbar sind.
   */
  class FakePacing {
    public enabled = true;
    private busyUntil = 0;

    isEnabled(): boolean {
      return this.enabled;
    }
    estimateMs(text: string): number {
      return text.length * 10;
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

  const build = (): MudScreenReaderAnnouncer =>
    new MudScreenReaderAnnouncer(
      liveRegion,
      historyRegion,
      () => false,
      undefined,
      () => level,
      pacing,
    );

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T12:00:00Z'));
    liveRegion = document.createElement('div');
    historyRegion = document.createElement('div');
    level = 'quiet';
    pacing = new FakePacing();
    announcer = build();
  });

  afterEach(() => {
    announcer.dispose();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('hängt in Stufe „Ruhig" AN, statt zu ersetzen (Hauptursache A)', () => {
    announcer.announce('Erster Block');
    jest.advanceTimersByTime(200);
    expect(liveRegion.children.length).toBe(1);

    announcer.announce('Zweiter Block');
    jest.advanceTimersByTime(10_000);

    // Ohne „Ausreden lassen" hielte die Region in 'quiet' genau EINEN Knoten.
    expect(liveRegion.children.length).toBe(2);
    expect(liveRegion.textContent).toContain('Erster Block');
    expect(liveRegion.textContent).toContain('Zweiter Block');
  });

  it('erzwingt in Stufe „Gesprächig" ein Mindest-Bündelungsfenster', () => {
    level = 'chatty';
    announcer = build();

    announcer.announce('A');
    // Ohne Pacing schriebe 'chatty' synchron.
    expect(liveRegion.children.length).toBe(0);

    jest.advanceTimersByTime(120);
    expect(liveRegion.children.length).toBe(1);
  });

  it('gibt die zweite Ansage erst nach der geschätzten Dauer der ersten frei', () => {
    // Erster Block: 201 Zeichen inkl. \n → 2010 ms belegt.
    announcer.announce('x'.repeat(200));
    jest.advanceTimersByTime(200); // Bündelungsfenster → wird geschrieben
    expect(liveRegion.children.length).toBe(1);

    announcer.announce('zweite');
    jest.advanceTimersByTime(200); // Bündelung durch, Uhr aber noch belegt
    expect(liveRegion.textContent).not.toContain('zweite');

    // Die Uhr lief erst ab dem Schreiben bei t=200, ist also bis t=2210
    // belegt; bei t=400 verbleiben 1810 ms.
    jest.advanceTimersByTime(1810);
    expect(liveRegion.textContent).toContain('zweite');
    expect(liveRegion.children.length).toBe(2);
  });

  it('trimmt die Live-Region nicht, solange etwas wartet (Ursache D)', () => {
    // Einen langen Block absetzen, damit die Uhr lange belegt ist ...
    announcer.announce('x'.repeat(2000));
    jest.advanceTimersByTime(200);
    const vorher = liveRegion.children.length;

    // ... und dann viele weitere einreihen, ohne die Zeit vorzurücken.
    for (let i = 0; i < 50; i++) {
      announcer.announce(`Nachricht ${i}`);
    }
    jest.advanceTimersByTime(200);

    // Nichts wurde weggetrimmt, der erste Block steht noch.
    expect(liveRegion.children.length).toBeGreaterThanOrEqual(vorher);
    expect(liveRegion.textContent).toContain('x'.repeat(50));
  });

  it('stopAnnouncements() verwirft Wartendes ohne Nachzügler', () => {
    announcer.announce('x'.repeat(2000));
    jest.advanceTimersByTime(200);
    announcer.announce('darf nicht mehr kommen');

    announcer.stopAnnouncements();
    jest.advanceTimersByTime(60_000);

    expect(liveRegion.textContent).toBe('');
    expect(pacing.remainingMs()).toBe(0);
  });

  it('markSessionStart() verwirft Wartendes ebenfalls', () => {
    announcer.announce('x'.repeat(2000));
    jest.advanceTimersByTime(200);
    announcer.announce('alte Sitzung');

    announcer.markSessionStart();
    jest.advanceTimersByTime(60_000);

    expect(liveRegion.textContent).toBe('');
  });

  it('dispose() hinterlässt keinen laufenden Timer', () => {
    announcer.announce('x'.repeat(2000));
    jest.advanceTimersByTime(200);
    announcer.announce('wartet');

    announcer.dispose();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('reserveSpeech() verzögert die nächste Ansage', () => {
    announcer.reserveSpeech('x'.repeat(100)); // 1000 ms belegt

    announcer.announce('kommt später');
    jest.advanceTimersByTime(200); // Bündelung durch, Uhr noch belegt
    expect(liveRegion.textContent).toBe('');

    jest.advanceTimersByTime(1000);
    expect(liveRegion.textContent).toContain('kommt später');
  });

  it('verhält sich bei ausgeschaltetem Schalter exakt wie zuvor', () => {
    pacing.enabled = false;

    announcer.announce('Erster');
    jest.advanceTimersByTime(200);
    announcer.announce('Zweiter');
    jest.advanceTimersByTime(200);

    // 'quiet' ohne Pacing: ERSETZEN, also genau ein Textknoten.
    expect(liveRegion.textContent).toBe('Zweiter\n');
    expect(liveRegion.children.length).toBe(0);
  });
});

/**
 * Zusammenspiel mit dem ECHTEN SpeechPacingService (nicht mit einem Doppel).
 * Prüft die Kette Ansage → Bündelung → Warteschlange → Live-Region so, wie sie
 * in `/ez` tatsächlich verdrahtet ist.
 */
describe('MudScreenReaderAnnouncer - Zusammenspiel mit SpeechPacingService', () => {
  let liveRegion: HTMLElement;
  let historyRegion: HTMLElement;
  let pacing: SpeechPacingService;
  let announcer: MudScreenReaderAnnouncer;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T12:00:00Z'));
    localStorage.clear();
    liveRegion = document.createElement('div');
    historyRegion = document.createElement('div');
    pacing = new SpeechPacingService();
    announcer = new MudScreenReaderAnnouncer(
      liveRegion,
      historyRegion,
      () => false,
      undefined,
      () => 'quiet' as OutputVerbosity,
      pacing,
    );
  });

  afterEach(() => {
    announcer.dispose();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('verhält sich mit ausgeschaltetem Schalter wie bisher (Ersetzen)', () => {
    announcer.announce('Erster');
    jest.advanceTimersByTime(200);
    announcer.announce('Zweiter');
    jest.advanceTimersByTime(200);

    expect(liveRegion.textContent).toBe('Zweiter\n');
  });

  it('lässt eingeschaltet die erste Ansage ausreden', () => {
    pacing.setEnabled(true);

    // ~600 Zeichen Raumbeschreibung: bei 200 WPM gut 27 s Sprechzeit.
    const raum = 'Du stehst auf einer weiten Lichtung. '.repeat(16);
    announcer.announce(raum);
    jest.advanceTimersByTime(200);
    expect(liveRegion.children.length).toBe(1);

    // Kurz darauf trifft neue Ausgabe ein — sie darf nicht dazwischenfunken.
    announcer.announce('Ein Ork kommt herein.');
    jest.advanceTimersByTime(1000);
    expect(liveRegion.textContent).not.toContain('Ork');

    // Erst wenn die Raumbeschreibung durch ist, kommt sie dran.
    jest.advanceTimersByTime(30_000);
    expect(liveRegion.textContent).toContain('Ork');
  });

  it('schreibt im Leerlauf ohne jede Verzögerung', () => {
    pacing.setEnabled(true);

    announcer.announce('Ok.');
    // Nur das Bündelungsfenster, keine zusätzliche Wartezeit.
    jest.advanceTimersByTime(200);

    expect(liveRegion.textContent).toContain('Ok.');
  });

  it('meldet bei Dauer-Spam, wie viel übersprungen wurde', () => {
    pacing.setEnabled(true);

    // 200 nicht verschmelzbare Meldungen ohne Zeitfortschritt dazwischen.
    for (let i = 0; i < 200; i++) {
      announcer.announce(`Kampfrunde ${i}: ${'Treffer! '.repeat(20)}`);
      jest.advanceTimersByTime(200); // je ein Bündelungsfenster
    }
    jest.advanceTimersByTime(600_000);

    expect(liveRegion.textContent).toContain('übersprungen');
    // Die jüngste Meldung hat den Rückstau überlebt.
    expect(liveRegion.textContent).toContain('Kampfrunde 199');
  });

  it('verwirft bei „Sprung zum Ende" den gesamten Rückstau', () => {
    pacing.setEnabled(true);

    announcer.announce('Lange Beschreibung. '.repeat(40));
    jest.advanceTimersByTime(200);
    announcer.announce('wartet noch');
    jest.advanceTimersByTime(200);

    announcer.stopAnnouncements();
    jest.advanceTimersByTime(120_000);

    expect(liveRegion.textContent).toBe('');
    expect(pacing.remainingMs()).toBe(0);
  });
});
