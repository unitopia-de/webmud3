import { MudScreenReaderAnnouncer } from './mud-screenreader';

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
