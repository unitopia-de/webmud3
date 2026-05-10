/**
 * Lightweight parser for the XML-ish tags UNItopia emits inside MXP secure-mode
 * windows. Only what we currently need — *not* a full XML parser:
 *
 *   - tag names: `rshort`, `rexit`, `stat`, `sound`, `!ENTITY`, `!ELEMENT`, …
 *   - close tags: `/rshort`, `/rexit`, …
 *   - attribute pairs: `name=value`, `name="value"`, `name='value'`, plus
 *     bare-name attributes (e.g. the `PUBLISH` flag in
 *     `<!ENTITY ap "100" PUBLISH>`).
 *
 * The first non-attribute "naked" token after the tag name is reported via
 * `firstNakedValue` — UNItopia uses it for the value of `<!ENTITY name
 * "value">` (the `"100"` is the entity value, not an attribute) and for
 * sound URLs in `<sound "kampf/treffer.mp3">`.
 */
export type ParsedMxpTag = {
  /** Tag name, lower-cased. Closing tags drop the leading `/`. */
  name: string;
  /** True when the source was `</name>` rather than `<name>`. */
  isClose: boolean;
  /** True when the tag started with `!` (declaration like ENTITY/ELEMENT). */
  isDeclaration: boolean;
  /** Map of attributes; keys are lower-cased. Values are unquoted. */
  attrs: Map<string, string>;
  /** First positional value (no `name=`), if any. See header docstring. */
  firstNakedValue?: string;
};

/**
 * Parses the *inside* of a tag — i.e. without the surrounding `<` `>`.
 * Pass either the full tag (with `<` `>`) or just the content; the function
 * trims either form. Returns `null` for anything that does not look like a
 * tag at all (empty input).
 */
export function parseMxpTag(raw: string): ParsedMxpTag | null {
  let body = raw.trim();
  if (body.startsWith('<')) {
    body = body.slice(1);
  }
  if (body.endsWith('>')) {
    body = body.slice(0, -1);
  }
  body = body.trim();
  if (body.length === 0) {
    return null;
  }

  const isClose = body.startsWith('/');
  if (isClose) {
    body = body.slice(1).trim();
  }
  const isDeclaration = body.startsWith('!');
  if (isDeclaration) {
    body = body.slice(1).trim();
  }

  const tokens = tokenize(body);
  if (tokens.length === 0) {
    return null;
  }

  const name = tokens[0].toLowerCase();
  const attrs = new Map<string, string>();
  let firstNakedValue: string | undefined;

  for (let i = 1; i < tokens.length; i++) {
    const tok = tokens[i];
    const eq = tok.indexOf('=');
    if (eq > 0) {
      const key = tok.slice(0, eq).toLowerCase();
      const value = unquote(tok.slice(eq + 1));
      attrs.set(key, value);
    } else {
      // Naked token: either a bare flag (`PUBLISH`) or — when it looks
      // like a quoted value — the first positional value of the tag.
      if (firstNakedValue === undefined && isQuoted(tok)) {
        firstNakedValue = unquote(tok);
      } else {
        // Treat the rest as bare flags so `attrs.has('publish')` works.
        attrs.set(tok.toLowerCase(), '');
      }
    }
  }

  return { name, isClose, isDeclaration, attrs, firstNakedValue };
}

/**
 * Splits the tag body into tokens. Whitespace separates tokens, but quoted
 * regions (single OR double) are kept together so a value like
 * `caption="AP:"` ends up as one token. Tokens that span an `=` keep the
 * attribute glued to its value (`name="value"`).
 */
function tokenize(body: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i])) {
      i += 1;
    }
    if (i >= body.length) {
      break;
    }

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
      if (/\s/.test(c)) {
        break;
      }
      if (c === "'") inSingle = true;
      else if (c === '"') inDouble = true;
      token += c;
      i += 1;
    }
    if (token.length > 0) {
      tokens.push(token);
    }
  }

  return tokens;
}

function isQuoted(value: string): boolean {
  return (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  );
}

function unquote(value: string): string {
  if (isQuoted(value)) {
    return value.slice(1, -1);
  }
  return value;
}
