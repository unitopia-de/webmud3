import { parseMxpTag } from './mxp-tag';

describe('parseMxpTag', () => {
  it('parses a simple tag with no attributes', () => {
    const t = parseMxpTag('<rshort>');
    expect(t).not.toBeNull();
    expect(t!.name).toBe('rshort');
    expect(t!.isClose).toBe(false);
    expect(t!.isDeclaration).toBe(false);
    expect(t!.attrs.size).toBe(0);
  });

  it('parses a closing tag', () => {
    const t = parseMxpTag('</rshort>')!;
    expect(t.name).toBe('rshort');
    expect(t.isClose).toBe(true);
  });

  it('parses an !ENTITY declaration', () => {
    const t = parseMxpTag('<!ENTITY ap "100" DESC="Ausdauerpunkte" PUBLISH>')!;
    expect(t.isDeclaration).toBe(true);
    // The first lower-cased token after `!` is the tag name — for !ENTITY
    // / !ELEMENT this is the keyword itself. The real entity name (`ap`
    // here) is the next token; the MxpTagRouter re-tokenises declarations
    // to recover it. parseMxpTag's job is only to identify the kind of
    // tag we are looking at.
    expect(t.name).toBe('entity');
    expect(t.attrs.get('desc')).toBe('Ausdauerpunkte');
    expect(t.attrs.has('publish')).toBe(true);
    expect(t.firstNakedValue).toBe('100');
    // The entity name comes through as a bare attribute key.
    expect(t.attrs.has('ap')).toBe(true);
  });

  it('parses a <stat> definition', () => {
    const t = parseMxpTag('<stat ap max=maxap caption="AP:">')!;
    expect(t.name).toBe('stat');
    expect(t.attrs.get('max')).toBe('maxap');
    expect(t.attrs.get('caption')).toBe('AP:');
  });

  it('parses an attribute value with quotes containing spaces', () => {
    const t = parseMxpTag('<send href="betrachte alle viecher">')!;
    expect(t.attrs.get('href')).toBe('betrachte alle viecher');
  });

  it('handles single-quoted values', () => {
    const t = parseMxpTag(`<send href='click me'>`)!;
    expect(t.attrs.get('href')).toBe('click me');
  });

  it('returns null for empty input', () => {
    expect(parseMxpTag('')).toBeNull();
    expect(parseMxpTag('<>')).toBeNull();
  });

  it('lowercases the tag name and attribute keys', () => {
    const t = parseMxpTag('<STAT AP CAPTION="X">')!;
    expect(t.name).toBe('stat');
    // First positional after `STAT` is `AP` — bare flag, not lowercased
    // value. We only lower-case keys, not values, so the entity reference
    // keeps its server-supplied casing.
    expect(t.attrs.has('ap')).toBe(true);
    expect(t.attrs.get('caption')).toBe('X');
  });
});
