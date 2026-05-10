import { inject, Injectable } from '@angular/core';

import { MxpClickableService } from './mxp-clickable.service';
import { MxpElementService } from './mxp-element.service';
import { MxpEntityService } from './mxp-entity.service';
import { MxpSoundService } from './mxp-sound.service';
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
  private readonly elements = inject(MxpElementService);
  private readonly clickables = inject(MxpClickableService);
  private readonly sounds = inject(MxpSoundService);

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

    if (parsed.isDeclaration && parsed.name === 'element') {
      this.handleElementDeclaration(rawTag);
      return;
    }

    if (parsed.name === 'stat') {
      // `<stat ap max=maxap caption="AP:">` — first token after `stat` is
      // the entity name; rest are attributes.
      this.handleStatDefinition(rawTag);
      return;
    }

    if (parsed.name === 'expire') {
      const domain = parsed.attrs.get('name') ?? parsed.firstNakedValue;
      if (domain) {
        this.clickables.expireDomain(domain);
      }
      return;
    }

    if (parsed.name === 'sound') {
      this.handleSoundTag(parsed.attrs, parsed.firstNakedValue);
      return;
    }
  }

  /**
   * Handles `<sound>` tags. Two flavours from UNItopia:
   *   - `<sound Off U="https://…">` — base URL announcement; we cache it.
   *   - `<sound "file.mp3">` — inline event; the file plays unless GMCP-
   *     sound is already active for the same effect.
   *
   * Distinguishing them: if a `U` attribute is present we treat the tag as
   * a base-URL announcement, otherwise the first naked value (the
   * `firstNakedValue` reported by parseMxpTag) is the file name.
   */
  private handleSoundTag(
    attrs: ReadonlyMap<string, string>,
    firstNakedValue: string | undefined,
  ): void {
    const url = attrs.get('u');
    if (url !== undefined) {
      this.sounds.setBaseUrl(url);
      return;
    }
    if (firstNakedValue !== undefined) {
      this.sounds.playEvent(firstNakedValue);
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

  /**
   * Parses `<!ELEMENT name 'template' FLAG=… ATT='…'>` and stores the
   * definition in MxpElementService. The template is the first single- or
   * double-quoted token after the element name; UNItopia consistently uses
   * single quotes (so the inner template can use double-quoted attributes
   * without escaping).
   */
  private handleElementDeclaration(rawTag: string): void {
    let body = rawTag.trim();
    if (body.startsWith('<')) body = body.slice(1);
    if (body.endsWith('>')) body = body.slice(0, -1);
    body = body.trim();
    body = body.replace(/^!\s*element\s+/i, '');

    const tokens = tokenize(body);
    if (tokens.length < 2) {
      return;
    }

    const name = tokens[0];
    const template = unquote(tokens[1]);

    let flag: string | undefined;
    const attNames: string[] = [];

    for (let i = 2; i < tokens.length; i++) {
      const tok = tokens[i];
      const eq = tok.indexOf('=');
      if (eq <= 0) continue;
      const key = tok.slice(0, eq).toLowerCase();
      const value = unquote(tok.slice(eq + 1));
      if (key === 'flag') {
        flag = value;
      } else if (key === 'att') {
        attNames.push(...value.split(/\s+/).filter((n) => n.length > 0));
      }
    }

    this.elements.define({
      name,
      template,
      flag,
      attNames: attNames.length > 0 ? attNames : undefined,
    });
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
