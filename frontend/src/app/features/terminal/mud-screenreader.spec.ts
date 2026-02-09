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

    const items = liveRegion.querySelectorAll('p.sr-log-item');
    expect(items.length).toBe(1);
    expect(items[0].textContent).toBe('Hello World');
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
    expect(liveRegion.textContent).toBe('Message');

    announcer.clear();
    expect(liveRegion.textContent).toBe('');
  });

  it('stopAnnouncements() clears live region and backlog', () => {
    announcer.announce('First');
    announcer.announce('Second');

    expect(liveRegion.textContent).toBe('FirstSecond');

    announcer.stopAnnouncements();
    expect(liveRegion.textContent).toBe('');
  });

  it('ignores empty output after normalization', () => {
    announcer.announce('\x1b[31m\x1b[0m');

    expect(liveRegion.textContent).toBe('');
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
