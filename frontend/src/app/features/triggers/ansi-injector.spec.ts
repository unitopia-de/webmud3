import {
  dropOverlaps,
  injectHighlights,
  stripAnsi,
} from './ansi-injector';
import type { HighlightSegment } from './models/highlight';

const ESC = '\x1b';

describe('stripAnsi', () => {
  it('removes CSI colour sequences', () => {
    const input = `${ESC}[31mred${ESC}[0m and normal`;
    expect(stripAnsi(input)).toBe('red and normal');
  });

  it('removes cursor-movement and screen control sequences', () => {
    const input = `before${ESC}[2J${ESC}[H${ESC}[?25lafter`;
    expect(stripAnsi(input)).toBe('beforeafter');
  });

  it('leaves plain text untouched', () => {
    expect(stripAnsi('plain text')).toBe('plain text');
  });
});

describe('injectHighlights', () => {
  function fg(start: number, end: number, colour: string): HighlightSegment {
    return { start, end, foreground: colour };
  }

  it('returns the original text when there are no highlights', () => {
    expect(injectHighlights('hello world', [])).toBe('hello world');
  });

  it('wraps a simple highlight with open/close SGR codes', () => {
    const out = injectHighlights('hello world', [fg(6, 11, '#ff0000')]);
    expect(out).toBe(
      `hello ${ESC}[38;2;255;0;0mworld${ESC}[0m`,
    );
  });

  it('emits a foreground triple for #rgb shortform', () => {
    const out = injectHighlights('abc', [fg(0, 1, '#f00')]);
    expect(out).toBe(`${ESC}[38;2;255;0;0ma${ESC}[0mbc`);
  });

  it('supports bold + foreground + background', () => {
    const out = injectHighlights('X', [
      { start: 0, end: 1, foreground: '#fff', background: '#000', bold: true },
    ]);
    expect(out).toBe(
      `${ESC}[1;38;2;255;255;255;48;2;0;0;0mX${ESC}[0m`,
    );
  });

  it('skips a highlight whose colours are all undefined', () => {
    const out = injectHighlights('xyz', [{ start: 0, end: 1 }]);
    expect(out).toBe('xyz');
  });

  it('preserves ANSI codes that surround the highlighted run', () => {
    // visible: "redgreenblue"
    const input = `${ESC}[31mred${ESC}[32mgreen${ESC}[34mblue${ESC}[0m`;
    // Highlight "green" -> visible positions 3..8
    const out = injectHighlights(input, [fg(3, 8, '#ffff00')]);
    expect(out).toBe(
      `${ESC}[31mred${ESC}[32m${ESC}[38;2;255;255;0mgreen${ESC}[0m${ESC}[34mblue${ESC}[0m`,
    );
  });

  it('places several non-overlapping highlights', () => {
    const out = injectHighlights('aXbYc', [
      fg(1, 2, '#f00'),
      fg(3, 4, '#0f0'),
    ]);
    expect(out).toBe(
      `a${ESC}[38;2;255;0;0mX${ESC}[0mb${ESC}[38;2;0;255;0mY${ESC}[0mc`,
    );
  });

  it('handles a highlight at the very end of the string', () => {
    const out = injectHighlights('end', [fg(0, 3, '#888')]);
    expect(out).toBe(`${ESC}[38;2;136;136;136mend${ESC}[0m`);
  });
});

describe('dropOverlaps', () => {
  it('keeps disjoint segments untouched', () => {
    const a = { start: 0, end: 3 };
    const b = { start: 5, end: 8 };
    expect(dropOverlaps([a, b])).toEqual([a, b]);
  });

  it('drops later segments that overlap an earlier one', () => {
    const a = { start: 0, end: 5 };
    const b = { start: 3, end: 7 };
    const c = { start: 6, end: 8 };
    expect(dropOverlaps([a, b, c])).toEqual([a, c]);
  });

  it('sorts ascending before resolving overlaps', () => {
    const a = { start: 5, end: 8 };
    const b = { start: 0, end: 3 };
    expect(dropOverlaps([a, b])).toEqual([b, a]);
  });
});
