import { Injectable } from '@angular/core';

/**
 * Holds the `<!ELEMENT>` definitions UNItopia pushes during init_mxp().
 *
 * Example raw declarations:
 *   <!ELEMENT rexit      '<send expire="room">'                           FLAG=RoomExit>
 *   <!ELEMENT ircontent  '<send href="betrachte &id;|fuehle &id;..."
 *                          expire="room">' ATT='id'>
 *
 * For our purposes (stage 3 click handling) we only need to know:
 *   - the *expansion template* (the single-quoted body — typically a
 *     `<send …>` tag)
 *   - the FLAG (RoomDesc / RoomName / RoomExit) — currently unused but
 *     stored so future stages can pick it up
 *   - the ATT attribute names that the source tag may carry (e.g. `id`).
 *     We use this only as a hint; resolution looks at every attribute on
 *     the source tag anyway.
 *
 * `resolve(name, sourceAttrs)` returns the expanded body with `&entity;`
 * placeholders replaced by values from `sourceAttrs`. Returns `null` for
 * unknown elements.
 */
export type MxpElementDefinition = {
  /** Element name, lower-cased (e.g. `rexit`). */
  name: string;
  /** Single-quoted expansion body (e.g. `<send href="..." expire="room">`). */
  template: string;
  /** Optional `FLAG=RoomExit` value (currently informational). */
  flag?: string;
  /** Names listed in `ATT='...'` (currently informational). */
  attNames?: string[];
};

/**
 * Result of resolving a clickable element occurrence: the contained `<send>`
 * details that drive the actual click action.
 */
export type ResolvedSend = {
  /** Pipe-separated href list as written by the server. */
  href: string;
  /** Optional `expire="..."` domain such as "room". */
  expire?: string;
};

@Injectable({ providedIn: 'root' })
export class MxpElementService {
  private readonly defs = new Map<string, MxpElementDefinition>();

  public define(def: MxpElementDefinition): void {
    this.defs.set(def.name.toLowerCase(), def);
  }

  public get(name: string): MxpElementDefinition | undefined {
    return this.defs.get(name.toLowerCase());
  }

  public clear(): void {
    this.defs.clear();
  }

  /**
   * Resolves a source-tag occurrence (e.g. `<ircontent id="goblin">`) to the
   * effective `<send href="..." expire="...">` it stands for. Substitutes
   * `&id;`-style entity references with values from the source tag's
   * attributes.
   *
   * Returns `null` when no element definition exists or the template does
   * not contain a `<send>` (e.g. `rshort`, `rlong` — informational only).
   */
  public resolve(
    name: string,
    sourceAttrs: ReadonlyMap<string, string>,
  ): ResolvedSend | null {
    const def = this.get(name);
    if (def === undefined) {
      return null;
    }

    const expanded = expandEntityRefs(def.template, sourceAttrs);
    return extractSend(expanded);
  }
}

const ENTITY_REF_RE = /&([a-zA-Z][\w-]*);/g;

function expandEntityRefs(
  template: string,
  attrs: ReadonlyMap<string, string>,
): string {
  return template.replace(ENTITY_REF_RE, (_match, name: string) => {
    const value = attrs.get(name.toLowerCase()) ?? attrs.get(name);
    return value ?? '';
  });
}

/**
 * Extracts `href` and `expire` from the first `<send …>` inside `expanded`.
 * The template typically *is* a `<send>` tag; we still scan defensively
 * because future server-side changes might wrap it in something else.
 */
function extractSend(expanded: string): ResolvedSend | null {
  const start = expanded.toLowerCase().indexOf('<send');
  if (start === -1) {
    return null;
  }
  const close = expanded.indexOf('>', start);
  if (close === -1) {
    return null;
  }
  const body = expanded.slice(start + '<send'.length, close);

  const href = readAttr(body, 'href');
  if (href === undefined) {
    return null;
  }
  const expire = readAttr(body, 'expire');
  return { href, expire };
}

function readAttr(body: string, name: string): string | undefined {
  // Match `name=value`, `name="value"` or `name='value'`. Robust enough
  // for the small set of patterns UNItopia emits; not a full XML parser.
  const re = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`,
    'i',
  );
  const m = re.exec(body);
  if (m === null) {
    return undefined;
  }
  return m[1] ?? m[2] ?? m[3];
}
