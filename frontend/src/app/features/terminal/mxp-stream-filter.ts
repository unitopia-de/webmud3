/**
 * Strips MXP control bytes and tags from the server output stream.
 *
 * Stage-1 of the MXP roadmap (see u3_migrate/MXP.md): once the backend
 * accepts the TELOPT_MXP negotiation, UNItopia embeds three kinds of
 * sequences in the regular stream:
 *
 *   1. Mode switches:    `ESC[1z` (line-secure), `ESC[4z` (temp-secure),
 *                        `ESC[7z` (locked).
 *   2. XML-ish tags:     `<rshort>...</rshort>`, `<!ELEMENT ...>`,
 *                        `<!ENTITY ...>`, `<stat ...>`, `<sound ...>`,
 *                        `<send href="..."> ... </send>`, `<expire ...>`,
 *                        `<rexit>`, `<ircontent ...>` etc.
 *   3. The literal `&id;` references inside expanded `<send>` elements
 *      — those only become relevant once we render clickable tags
 *      (stage 3+); for stage 1 we leave any `&entity;` reference alone
 *      so plain text containing `&` characters is preserved.
 *
 * The filter is **stateful** because both the mode (locked vs. secure)
 * and incomplete tags can span chunk boundaries:
 *
 *   - A chunk may end mid-CSI (`ESC[`), inside a tag (`<rshort`), or with
 *     a stray `<` that *might* be the start of a tag if the next chunk
 *     opens with a tag-name character.
 *   - The mode set by `ESC[1z`/`[4z` only applies to the *next* `<...>`
 *     occurrence (temp) or to all `<...>` until end of line (line). We
 *     conservatively treat *any* `<` after a secure-mode switch as a tag
 *     opener and strip until the matching `>`. UNItopia only emits real
 *     tags inside its secure-mode windows, so this matches reality.
 *
 * What we deliberately do NOT do here:
 *   - Parse `<!ELEMENT>` / `<!ENTITY>` definitions (stage 2/3).
 *   - Track a per-chunk MXP "active" boolean — the filter strips bytes
 *     unconditionally. Servers that never enter MXP mode never emit
 *     these sequences, so dead-stripping is fine.
 */

const ESC = '\u001b';

/**
 * Callback fired for every complete MXP tag the filter encounters. The
 * raw form (e.g. `<!ENTITY ap "100" PUBLISH>`) is passed through verbatim
 * so consumers can decide what to parse — see `parseMxpTag`. The filter
 * never emits the bytes into the output stream regardless of whether the
 * callback is set.
 */
export type MxpTagCallback = (rawTag: string) => void;

export class MxpStreamFilter {
  /** Holds bytes belonging to an unfinished CSI / tag from the previous chunk. */
  private pending = '';
  /** Discriminates *what* `pending` represents: CSI sequence vs. MXP tag. */
  private pendingKind: 'csi' | 'tag' | 'none' = 'none';

  /**
   * Optional sink for parsed-but-stripped tags. Stage-1 callers leave it
   * unset; stage-2+ wires it up so `<!ENTITY>`, `<stat>`, etc. flow into
   * `MxpEntityService` / `MxpStatService` etc.
   */
  constructor(private readonly onTag?: MxpTagCallback) {}

  /**
   * Removes every MXP-related byte sequence from `chunk` and returns the
   * cleaned text. Incomplete sequences at the end are remembered for the
   * next call — the bytes are NOT emitted in this chunk.
   */
  public process(chunk: string): string {
    if (chunk.length === 0) {
      return '';
    }

    let out = '';
    let i = 0;
    let buf = '';
    let kind: 'csi' | 'tag' | 'none' = 'none';

    // Resume any partial state from the previous chunk by prepending its
    // raw bytes back into the input. Re-running the parser on the joined
    // input is simpler — and almost always cheaper — than wiring two state
    // machines together.
    if (this.pendingKind !== 'none') {
      chunk = this.pending + chunk;
      this.pending = '';
      this.pendingKind = 'none';
    }

    while (i < chunk.length) {
      const ch = chunk[i];

      if (kind === 'none') {
        if (ch === ESC) {
          // Possibly an MXP mode switch `ESC[Nz`. Buffer until we know.
          buf = ESC;
          kind = 'csi';
          i += 1;
          continue;
        }

        if (ch === '<' && this.looksLikeMxpTag(chunk, i)) {
          // MXP tag — gobble until matching `>`. Inside the tag there may
          // be quoted attribute values that contain `>`; we honour basic
          // single/double quoting to avoid an early stop.
          buf = '<';
          kind = 'tag';
          i += 1;
          continue;
        }

        out += ch;
        i += 1;
        continue;
      }

      if (kind === 'csi') {
        // We are inside a buffer that started with ESC. We only swallow
        // sequences of the form ESC[Nz where N is one or more digits.
        // Anything else has to flow through unchanged so we don't cripple
        // ANSI colour codes.
        buf += ch;
        i += 1;

        // Validate prefix: ESC, then optionally `[`, then digits (>=1),
        // then `z` to terminate.
        if (buf.length === 2) {
          if (buf[1] !== '[') {
            // Not a CSI at all — emit verbatim and reset.
            out += buf;
            buf = '';
            kind = 'none';
          }
          continue;
        }

        // We have at least ESC[ + something. Walk the rest.
        const tail = buf[buf.length - 1];
        if (tail >= '0' && tail <= '9') {
          continue; // still collecting digits
        }
        if (tail === 'z') {
          // Confirmed `ESC[<digits>z`. Verify there *were* digits.
          if (buf.length > 3) {
            // Drop it entirely.
          } else {
            // Malformed (`ESC[z`) — emit verbatim.
            out += buf;
          }
          buf = '';
          kind = 'none';
          continue;
        }
        // Some other CSI terminator — not MXP, e.g. ANSI colour code
        // `ESC[33m`. Emit the whole buffer unchanged.
        out += buf;
        buf = '';
        kind = 'none';
        continue;
      }

      if (kind === 'tag') {
        buf += ch;
        i += 1;

        // Track quoted regions to avoid stopping at a `>` inside an
        // attribute value such as `<send href="a > b">`. UNItopia uses
        // both single and double quotes in its element definitions.
        const quoteState = this.findClosingTagBracket(buf);
        if (quoteState === -1) {
          continue;
        }

        // Tag is complete — emit it to the listener (if any) and drop it
        // from the output stream.
        if (this.onTag !== undefined) {
          this.onTag(buf);
        }
        buf = '';
        kind = 'none';
        continue;
      }
    }

    // Anything still in `buf` is incomplete and waits for the next chunk.
    if (kind !== 'none') {
      this.pending = buf;
      this.pendingKind = kind;
    }

    return out;
  }

  /**
   * Heuristic: does `chunk[start..]` look like an MXP tag start? We only
   * swallow `<` if the next character is one of `<` itself (false alarm —
   * leave alone), `!` (declaration), `/` (closing tag) or an ASCII letter
   * (regular tag name). That keeps ordinary `<` characters in plain MUD
   * text (e.g. "1 < 2") intact when they are followed by a digit / space.
   */
  private looksLikeMxpTag(chunk: string, start: number): boolean {
    if (start + 1 >= chunk.length) {
      // Could be a tag whose content arrives in the next chunk — buffer.
      return true;
    }
    const next = chunk[start + 1];
    if (next === '!' || next === '/') {
      return true;
    }
    return (next >= 'a' && next <= 'z') || (next >= 'A' && next <= 'Z');
  }

  /**
   * Returns the position of the closing `>` of the buffered tag, or -1 if
   * the tag is not complete yet. Honours single- and double-quoted attribute
   * values so a `>` inside `attr="..."` is not mistaken for the terminator.
   */
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

  /** Drops any buffered partial sequence (e.g. on disconnect / reconnect). */
  public reset(): void {
    this.pending = '';
    this.pendingKind = 'none';
  }
}
