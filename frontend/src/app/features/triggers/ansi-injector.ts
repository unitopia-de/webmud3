import type { HighlightSegment } from './models/highlight';

/**
 * ANSI / xterm helpers used by the trigger engine to overlay highlights on
 * server output without breaking the surrounding ANSI state.
 *
 * Caveat: when a highlight ends we emit `ESC[0m` (full reset). Any colour
 * the server set before the match is lost for the rest of the chunk. This
 * is the simple-but-imperfect option from the spec; tracking the prior SGR
 * state for restoration is feasible later if it turns out to be a problem.
 */

const ESC = '';
const CSI_RE = /\x1b\[[0-9;?]*[A-Za-z]/y;

/**
 * Strips ANSI CSI sequences from `text` and returns the visible-only
 * string. Used by the engine to feed regexes a representation that mirrors
 * what the user actually sees in the terminal.
 */
export function stripAnsi(text: string): string {
  // Lazy CSI match across the string. The same regex is used in
  // `injectHighlights` below — keep the two implementations in sync.
  return text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
}

/**
 * Returns a new string in which each highlight segment (given in visible
 * coordinates) is wrapped with SGR open/close sequences.
 *
 * Assumptions on `highlights`:
 *   - sorted by `start` ascending,
 *   - non-overlapping (the engine resolves overlaps before calling here),
 *   - `start < end`, both within `[0, visibleLength]`.
 */
export function injectHighlights(
  text: string,
  highlights: HighlightSegment[],
): string {
  if (highlights.length === 0) {
    return text;
  }

  const out: string[] = [];
  const len = text.length;

  let i = 0;
  let visiblePos = 0;
  let hIdx = 0;
  let openEmitted = false;
  let openEnd = -1;

  while (i < len) {
    // ANSI escapes are emitted as-is and don't consume a visible position.
    // We process them *before* opening a highlight so the server's own SGR
    // codes always sit outside the wrapper we inject.
    CSI_RE.lastIndex = i;
    const m = CSI_RE.exec(text);
    if (m !== null && m.index === i) {
      out.push(m[0]);
      i += m[0].length;
      continue;
    }

    // Skip past any zero-width or styling-less highlights that bracket this
    // position without contributing output.
    while (hIdx < highlights.length) {
      const h = highlights[hIdx];
      if (visiblePos < h.start) break;
      if (h.end <= h.start) {
        hIdx++;
        continue;
      }
      if (visiblePos === h.start) {
        const open = openSgr(h);
        if (open === '') {
          // Nothing to render — treat the whole segment as a no-op.
          hIdx++;
          continue;
        }
        out.push(open);
        openEmitted = true;
        openEnd = h.end;
      }
      break;
    }

    // Emit the visible character.
    out.push(text[i]);
    i++;
    visiblePos++;

    // Close once we've passed the matching end.
    if (openEmitted && visiblePos === openEnd) {
      out.push(`${ESC}[0m`);
      openEmitted = false;
      openEnd = -1;
      hIdx++;
    }
  }

  // Highlights that haven't been opened yet (because they start past the end
  // of the visible run) are dropped silently.
  return out.join('');
}

/** Drops overlapping highlights — earlier wins, later are dropped entirely. */
export function dropOverlaps(
  highlights: readonly HighlightSegment[],
): HighlightSegment[] {
  const sorted = [...highlights].sort((a, b) => a.start - b.start);
  const result: HighlightSegment[] = [];

  for (const h of sorted) {
    const last = result[result.length - 1];
    if (last && h.start < last.end) {
      // Overlap with the previously kept segment — drop the later one.
      continue;
    }
    result.push(h);
  }
  return result;
}

/** Builds the opening SGR sequence for a highlight, or '' if it has no styling. */
function openSgr(h: HighlightSegment): string {
  const parts: string[] = [];
  if (h.bold === true) {
    parts.push('1');
  }
  if (typeof h.foreground === 'string') {
    const fg = parseHex(h.foreground);
    if (fg !== null) {
      parts.push(`38;2;${fg.r};${fg.g};${fg.b}`);
    }
  }
  if (typeof h.background === 'string') {
    const bg = parseHex(h.background);
    if (bg !== null) {
      parts.push(`48;2;${bg.r};${bg.g};${bg.b}`);
    }
  }
  if (parts.length === 0) {
    return '';
  }
  return `${ESC}[${parts.join(';')}m`;
}

/** Parses `#rgb` / `#rrggbb` into bytes, or returns null on bad input. */
function parseHex(input: string): { r: number; g: number; b: number } | null {
  const s = input.startsWith('#') ? input.slice(1) : input;
  if (s.length === 3) {
    const r = parseInt(s[0] + s[0], 16);
    const g = parseInt(s[1] + s[1], 16);
    const b = parseInt(s[2] + s[2], 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return { r, g, b };
  }
  if (s.length === 6) {
    const r = parseInt(s.slice(0, 2), 16);
    const g = parseInt(s.slice(2, 4), 16);
    const b = parseInt(s.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return { r, g, b };
  }
  return null;
}
