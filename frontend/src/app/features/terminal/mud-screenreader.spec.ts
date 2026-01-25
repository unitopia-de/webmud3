import { MudScreenReaderAnnouncer } from './mud-screenreader';

describe('MudScreenReaderAnnouncer', () => {
  let liveRegion: HTMLElement;
  let announcer: MudScreenReaderAnnouncer;

  beforeEach(() => {
    jest.useFakeTimers();
    liveRegion = document.createElement('div');
    // Explicitly skip history region while overriding clear delay for tests
    announcer = new MudScreenReaderAnnouncer(
      liveRegion,
      undefined,
      undefined,
      100,
    );
  });

  afterEach(() => {
    announcer.dispose();
    jest.useRealTimers();
  });

  it('announces sanitized text and clears after delay', () => {
    announcer.announce('Hello \x1b[31mWorld\x1b[0m\r\n');

    expect(liveRegion.textContent).toBe('Hello World');

    jest.advanceTimersByTime(99);
    expect(liveRegion.textContent).toBe('Hello World');

    jest.advanceTimersByTime(1);
    expect(liveRegion.textContent).toBe('');
  });

  it('ignores announcements older than the current session', () => {
    const now = Date.now();
    const earlier = now - 500;

    announcer.markSessionStart(now);
    announcer.announce('Old content', earlier);

    expect(liveRegion.textContent).toBe('');
  });

  it('resets the clear timer for rapid consecutive announcements', () => {
    announcer.announce('First');
    jest.advanceTimersByTime(50);

    announcer.announce('Second');
    jest.advanceTimersByTime(99);

    expect(liveRegion.textContent).toBe('Second');

    jest.advanceTimersByTime(1);
    expect(liveRegion.textContent).toBe('');
  });

  it('clear() empties the live region immediately', () => {
    announcer.announce('Message');
    expect(liveRegion.textContent).toBe('Message');

    announcer.clear();
    expect(liveRegion.textContent).toBe('');
  });

  it('ignores empty output after normalization', () => {
    announcer.announce('\x1b[31m\x1b[0m');

    expect(liveRegion.textContent).toBe('');
  });
});
