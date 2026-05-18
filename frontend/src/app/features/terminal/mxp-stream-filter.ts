/**
 * Strips MXP control bytes from the server output stream and exposes the
 * result as a list of segments. Plain text segments contain the *cleaned*
 * bytes (ANSI colour codes preserved); clickable segments carry the same
 * cleaned content plus the tag name and attributes that triggered them.
 *
 * The MXP format details (mode switches, tag shapes, the UNItopia
 * workaround quirks) are documented in u3_migrate/MXP.md.
 *
 * Stage 1 only used `process(chunk): string`; stage 3 introduces
 * `processToSegments(chunk): StreamSegment[]` which drives the inline
 * clickable-tag rendering. `process` is kept as a thin wrapper that joins
 * every segment's text — handy for tests and any consumer that does not
 * care about clickability.
 *
 * The filter is **stateful**:
 *   - `pending` / `pendingKind` carry an unfinished CSI or tag across
 *     chunk boundaries.
 *   - `clickStack` tracks the currently-open clickable tag so we know
 *     which content goes into which segment when ANSI / nested-mode
 *     bytes are mixed in.
 */

const ESC = '\u001b';

/** Tags whose content should become a clickable region in the terminal. */
const CLICKABLE_TAGS = new Set([
  'rexit',
  'send',
  'ircontent',
  'lrcontent',
  'iinventory',
  // Encyclopedia helpers: `<enzyfun>X</enzyfun>` sends `? X` (function
  // lookup), `<enzybsp>X</enzybsp>` sends `bsp? X` (example lookup). The
  // server emits them as bare tags with the lookup target as the visible
  // text — same shape as `<rexit>`. The actual command is built in
  // `deriveClickAction` (rexit-style special case), no `<!ELEMENT>`
  // declaration is needed because we never go through the resolve path.
  'enzyfun',
  'enzybsp',
]);

export type ParsedTagAttrs = ReadonlyMap<string, string>;

export type StreamSegment =
  | { type: 'text'; content: string }
  | {
      type: 'clickable';
      /** Lower-cased tag name, e.g. `rexit`, `ircontent`. */
      tag: string;
      attrs: ParsedTagAttrs;
      /** The visible text between `<tag>` and `</tag>`, with ANSI codes kept. */
      content: string;
    };

/**
 * Callback fired for every complete MXP tag the filter encounters
 * (including standalone declarations like `<!ENTITY>` and the open/close
 * tags of clickable scopes — listeners can choose what to consume).
 *
 * The raw form is passed through verbatim; consumers parse it with
 * `parseMxpTag` if they need structure.
 */
export type MxpTagCallback = (rawTag: string) => void;

type FilterState = {
  /** Either the global text buffer or a clickable scope's content buffer. */
  current: { kind: 'text' | 'click'; buf: string; openTag?: ClickScope };
  /** Stack of open clickable scopes. UNItopia never nests these, but we
   *  still cope with it by suspending the outer scope. */
  clickStack: ClickScope[];
  /** Accumulated segments emitted in this `processToSegments` call. */
  segments: StreamSegment[];
};

type ClickScope = {
  tag: string;
  attrs: ParsedTagAttrs;
  /** Buffer collecting the visible content between open and close tag. */
  content: string;
};

/**
 * MXP parser mode driven by the `ESC[Nz` switches in the server stream.
 *
 *   - `locked` — `<` is literal text. The default at session start and
 *                between MXP sequences. UNItopia's workaround for
 *                non-mudlet clients (us) explicitly closes every
 *                MXP sequence with `ESC[7z`, so plain output between
 *                tags stays here.
 *   - `secure` — entered via `ESC[1z` (line secure, used for the init
 *                push) or `ESC[4z` (temp secure, wrapped around each
 *                inline tag). Tags inside this range are parsed.
 *
 * The MXP spec technically distinguishes `[1z` (until newline) and
 * `[4z` (single tag, then auto-revert). UNItopia always pairs both
 * with an explicit `ESC[7z`, so collapsing the two into a single
 * `secure` state matches the wire reality and is simpler. The auto-
 * revert variant would break UNItopia's `ESC[4z<tag>content</tag>ESC[7z`
 * pattern (the closing tag would land in locked mode and not be parsed).
 *
 * Without mode tracking the filter swallowed any `<…>` pattern even in
 * plain content — e.g. `cat foo.c` showing `#include <stdio.h>` lost
 * the `<stdio.h>`.
 */
type MxpMode = 'locked' | 'secure';

export class MxpStreamFilter {
  private pending = '';
  private pendingKind: 'csi' | 'tag' | 'none' = 'none';
  /** Click-scopes currently open across chunks. */
  private clickStack: ClickScope[] = [];
  private mxpMode: MxpMode = 'locked';

  constructor(private readonly onTag?: MxpTagCallback) {}

  /**
   * Parses `chunk` and returns the list of stripped/clickable segments.
   * Incomplete CSIs / tags / clickable scopes at the end of the chunk are
   * remembered for the next call — their bytes are NOT emitted yet.
   */
  public processToSegments(chunk: string): StreamSegment[] {
    if (chunk.length === 0) {
      return [];
    }

    // Resume any partial CSI / tag from the previous chunk.
    if (this.pendingKind !== 'none') {
      chunk = this.pending + chunk;
      this.pending = '';
      this.pendingKind = 'none';
    }

    const state: FilterState = {
      current: this.clickStack.length > 0
        ? {
            kind: 'click',
            buf: '',
            openTag: this.clickStack[this.clickStack.length - 1],
          }
        : { kind: 'text', buf: '' },
      clickStack: this.clickStack,
      segments: [],
    };

    let i = 0;
    let buf = '';
    let kind: 'csi' | 'tag' | 'none' = 'none';

    while (i < chunk.length) {
      const ch = chunk[i];

      if (kind === 'none') {
        if (ch === ESC) {
          buf = ESC;
          kind = 'csi';
          i += 1;
          continue;
        }

        if (
          ch === '<' &&
          this.mxpMode !== 'locked' &&
          this.looksLikeMxpTag(chunk, i)
        ) {
          buf = '<';
          kind = 'tag';
          i += 1;
          continue;
        }

        this.appendVisible(state, ch);
        i += 1;
        continue;
      }

      if (kind === 'csi') {
        buf += ch;
        i += 1;

        if (buf.length === 2) {
          if (buf[1] !== '[') {
            // Not a CSI — emit verbatim into the current target.
            for (const c of buf) this.appendVisible(state, c);
            buf = '';
            kind = 'none';
          }
          continue;
        }

        const tail = buf[buf.length - 1];
        if (tail >= '0' && tail <= '9') {
          continue;
        }
        if (tail === 'z') {
          // Confirmed MXP mode switch — drop the bytes and update state.
          if (buf.length === 3) {
            // `ESC[z` (no digits) — malformed, emit verbatim instead of
            // silently swallowing it. Mode stays put.
            for (const c of buf) this.appendVisible(state, c);
          } else {
            // Digits between `ESC[` and `z` identify the new mode.
            // Per MXP.md §2.1: 1 = Line Secure, 4 = Temp Secure, 7 =
            // Locked. We collapse 1 and 4 into `secure` (see the type
            // declaration above for why). Unknown codes leave the mode
            // alone — the bytes are still stripped because the server
            // clearly intended a mode switch.
            const digits = buf.slice(2, -1);
            if (digits === '1' || digits === '4') {
              this.mxpMode = 'secure';
            } else if (digits === '7') {
              this.mxpMode = 'locked';
            }
          }
          buf = '';
          kind = 'none';
          continue;
        }
        // Other CSI terminator (e.g. ANSI colour `ESC[33m`) — keep as-is.
        for (const c of buf) this.appendVisible(state, c);
        buf = '';
        kind = 'none';
        continue;
      }

      if (kind === 'tag') {
        buf += ch;
        i += 1;

        if (this.findClosingTagBracket(buf) === -1) {
          continue;
        }

        // Tag is complete. Drop the bytes from the visible stream and
        // dispatch to listeners + click-scope tracker.
        if (this.onTag !== undefined) {
          this.onTag(buf);
        }
        this.handleCompleteTag(state, buf);
        buf = '';
        kind = 'none';
        continue;
      }
    }

    // Anything still in `buf` is incomplete — wait for the next chunk.
    if (kind !== 'none') {
      this.pending = buf;
      this.pendingKind = kind;
    }

    // Flush whatever's in `state.current.buf` as a segment.
    this.flushCurrent(state);

    // Persist click stack across chunks (in case a clickable tag spans
    // multiple chunks, e.g. its content keeps coming).
    this.clickStack = state.clickStack;

    return state.segments;
  }

  /**
   * Backward-compatible API — joins every segment's text. Use this when the
   * caller does not care about clickable regions.
   */
  public process(chunk: string): string {
    return this.processToSegments(chunk)
      .map((s) => s.content)
      .join('');
  }

  /** Drops any buffered partial sequence and any open click scope. */
  public reset(): void {
    this.pending = '';
    this.pendingKind = 'none';
    this.clickStack = [];
    this.mxpMode = 'locked';
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private appendVisible(state: FilterState, ch: string): void {
    state.current.buf += ch;
  }

  /**
   * Closes whatever segment the filter is currently writing into and pushes
   * it onto `state.segments`. Empty text segments are dropped; empty
   * clickable segments are kept (the click-scope still exists, just with
   * no content yet — we will pick up content from the next chunk).
   */
  private flushCurrent(state: FilterState): void {
    if (state.current.kind === 'text') {
      if (state.current.buf.length > 0) {
        state.segments.push({ type: 'text', content: state.current.buf });
      }
      state.current = { kind: 'text', buf: '' };
      return;
    }

    // click scope — write whatever we collected into the open scope's content.
    const scope = state.current.openTag;
    if (scope === undefined) {
      // Should not happen, but be defensive: treat as plain text.
      if (state.current.buf.length > 0) {
        state.segments.push({ type: 'text', content: state.current.buf });
      }
      state.current = { kind: 'text', buf: '' };
      return;
    }
    scope.content += state.current.buf;
    state.current = { kind: 'click', buf: '', openTag: scope };
  }

  private handleCompleteTag(state: FilterState, rawTag: string): void {
    const parsed = parseSimple(rawTag);
    if (parsed === null) {
      return;
    }
    const { name, isClose, attrs } = parsed;

    if (parsed.isDeclaration) {
      // Standalone declaration (!ENTITY / !ELEMENT) — no scope effect.
      return;
    }

    if (CLICKABLE_TAGS.has(name)) {
      if (isClose) {
        this.closeClickScope(state, name);
      } else {
        this.openClickScope(state, name, attrs);
      }
      return;
    }

    // Other tags (rshort, rlong, stat, sound, expire, …) — no scope effect.
  }

  private openClickScope(
    state: FilterState,
    tag: string,
    attrs: ParsedTagAttrs,
  ): void {
    // First, finalise whatever segment we were writing.
    this.flushCurrent(state);

    const scope: ClickScope = { tag, attrs, content: '' };
    state.clickStack.push(scope);
    state.current = { kind: 'click', buf: '', openTag: scope };
  }

  private closeClickScope(state: FilterState, tag: string): void {
    // Flush any pending content into the top-of-stack scope first.
    this.flushCurrent(state);

    // Find the matching open scope. UNItopia uses well-formed tags so this
    // is almost always the top of the stack; we still walk the stack in
    // case nested scopes ever appear.
    let scope: ClickScope | undefined;
    for (let i = state.clickStack.length - 1; i >= 0; i--) {
      if (state.clickStack[i].tag === tag) {
        scope = state.clickStack[i];
        state.clickStack.splice(i, 1);
        break;
      }
    }

    if (scope !== undefined) {
      state.segments.push({
        type: 'clickable',
        tag: scope.tag,
        attrs: scope.attrs,
        content: scope.content,
      });
    }

    // Resume the parent scope (if any) or fall back to text mode.
    if (state.clickStack.length > 0) {
      state.current = {
        kind: 'click',
        buf: '',
        openTag: state.clickStack[state.clickStack.length - 1],
      };
    } else {
      state.current = { kind: 'text', buf: '' };
    }
  }

  private looksLikeMxpTag(chunk: string, start: number): boolean {
    if (start + 1 >= chunk.length) {
      return true;
    }
    const next = chunk[start + 1];
    if (next === '!' || next === '/') {
      return true;
    }
    return (next >= 'a' && next <= 'z') || (next >= 'A' && next <= 'Z');
  }

  private findClosingTagBracket(buf: string): number {
    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < buf.length; i++) {
      const c = buf[i];
      if (inSingle) {
        if (c === "'") inSingle = false;
        continue;
      }
      if (inDouble) {
        if (c === '"') inDouble = false;
        continue;
      }
      if (c === "'") inSingle = true;
      else if (c === '"') inDouble = true;
      else if (c === '>') return i;
    }
    return -1;
  }
}

// ---------------------------------------------------------------------------
// Light-weight tag parser used internally to avoid pulling the public
// `parseMxpTag` here (we only need name + attrs + the open/close/decl flag).
// ---------------------------------------------------------------------------

function parseSimple(raw: string): {
  name: string;
  isClose: boolean;
  isDeclaration: boolean;
  attrs: ParsedTagAttrs;
} | null {
  let body = raw.trim();
  if (body.startsWith('<')) body = body.slice(1);
  if (body.endsWith('>')) body = body.slice(0, -1);
  body = body.trim();
  if (body.length === 0) return null;

  const isClose = body.startsWith('/');
  if (isClose) body = body.slice(1).trim();
  const isDeclaration = body.startsWith('!');
  if (isDeclaration) body = body.slice(1).trim();

  const tokens: string[] = [];
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i])) i += 1;
    if (i >= body.length) break;
    let token = '';
    let inSingle = false;
    let inDouble = false;
    while (i < body.length) {
      const c = body[i];
      if (inSingle) {
        token += c;
        i += 1;
        if (c === "'") inSingle = false;
        continue;
      }
      if (inDouble) {
        token += c;
        i += 1;
        if (c === '"') inDouble = false;
        continue;
      }
      if (/\s/.test(c)) break;
      if (c === "'") inSingle = true;
      else if (c === '"') inDouble = true;
      token += c;
      i += 1;
    }
    if (token.length > 0) tokens.push(token);
  }

  if (tokens.length === 0) return null;

  const name = tokens[0].toLowerCase();
  const attrs = new Map<string, string>();
  for (let j = 1; j < tokens.length; j++) {
    const tok = tokens[j];
    const eq = tok.indexOf('=');
    if (eq > 0) {
      const key = tok.slice(0, eq).toLowerCase();
      let value = tok.slice(eq + 1);
      if (
        value.length >= 2 &&
        ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'")))
      ) {
        value = value.slice(1, -1);
      }
      attrs.set(key, value);
    } else {
      attrs.set(tok.toLowerCase(), '');
    }
  }

  return { name, isClose, isDeclaration, attrs };
}
