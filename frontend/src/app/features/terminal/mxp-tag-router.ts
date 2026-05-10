import { inject, Injectable } from '@angular/core';

import { MxpEntityService } from './mxp-entity.service';
import { MxpStatService } from './mxp-stat.service';
import { parseMxpTag } from './mxp-tag';

/**
 * Single dispatch point for MXP tags. The MudClientComponent constructs a
 * `MxpStreamFilter` with `(raw) => router.handle(raw)` so every stripped
 * tag flows into the right reactive store.
 *
 * What we currently route (Stage 2):
 *   - `<!ENTITY name "value" PUBLISH>` → MxpEntityService.set(name, value)
 *   - `<stat name max=maxname caption="…">` → MxpStatService.upsert({…})
 *
 * Anything else is silently ignored. Stages 3+ will hook in here for
 * `<rexit>`, `<send>`, `<expire>`, `<sound>` etc.
 */
@Injectable({ providedIn: 'root' })
export class MxpTagRouter {
  private readonly entities = inject(MxpEntityService);
  private readonly stats = inject(MxpStatService);

  public handle(rawTag: string): void {
    const parsed = parseMxpTag(rawTag);
    if (parsed === null) {
      return;
    }

    if (parsed.isClose) {
      // Closing tags carry no data we currently care about.
      return;
    }

    if (parsed.isDeclaration && parsed.name === 'entity') {
      // `<!ENTITY ap "100" DESC="…" PUBLISH>` — attrs[0] is the name (also
      // the parsed.name? no — parseMxpTag puts the whole declaration body
      // through tokenize, so the *real* entity name is the first token
      // after `!ENTITY`. We re-parse here for clarity.
      this.handleEntityDeclaration(rawTag);
      return;
    }

    if (parsed.name === 'stat') {
      // `<stat ap max=maxap caption="AP:">` — first token after `stat` is
      // the entity name; rest are attributes.
      this.handleStatDefinition(rawTag);
      return;
    }
  }

  /**
   * Re-tokenises an `<!ENTITY name value …>` declaration directly so we get
   * the positional `name` token. `parseMxpTag` would treat `name` as the
   * tag name itself, which works for routing but loses the actual entity
   * name we need.
   */
  private handleEntityDeclaration(rawTag: string): void {
    let body = rawTag.trim();
    if (body.startsWith('<')) body = body.slice(1);
    if (body.endsWith('>')) body = body.slice(0, -1);
    body = body.trim();
    // Strip the leading `!ENTITY` keyword (case-insensitive).
    body = body.replace(/^!\s*entity\s+/i, '');

    const tokens = tokenize(body);
    if (tokens.length < 2) {
      return;
    }

    const name = tokens[0];
    const rawValue = tokens[1];
    const value = unquote(rawValue);
    this.entities.set(name, value);
  }

  private handleStatDefinition(rawTag: string): void {
    let body = rawTag.trim();
    if (body.startsWith('<')) body = body.slice(1);
    if (body.endsWith('>')) body = body.slice(0, -1);
    body = body.trim();
    body = body.replace(/^stat\s+/i, '');

    const tokens = tokenize(body);
    if (tokens.length === 0) {
      return;
    }

    const name = tokens[0];
    let maxName: string | undefined;
    let caption: string | undefined;

    for (let i = 1; i < tokens.length; i++) {
      const tok = tokens[i];
      const eq = tok.indexOf('=');
      if (eq <= 0) continue;
      const key = tok.slice(0, eq).toLowerCase();
      const value = unquote(tok.slice(eq + 1));
      if (key === 'max') {
        maxName = value;
      } else if (key === 'caption') {
        caption = value;
      }
    }

    this.stats.upsert({ name, maxName, caption });
  }
}

// ---------------------------------------------------------------------------
// Local copies of the tokenize / unquote helpers from mxp-tag.ts. We keep
// them private here to avoid widening that file's public API just for the
// router's two re-parses. The duplication is small and stable.
// ---------------------------------------------------------------------------

function tokenize(body: string): string[] {
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
  return tokens;
}

function unquote(value: string): string {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
