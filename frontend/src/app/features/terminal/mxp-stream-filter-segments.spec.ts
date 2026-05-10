import { MxpStreamFilter, StreamSegment } from './mxp-stream-filter';

const ESC = '';

/** Helper to drop the verbose attrs map for compare. */
function shape(s: StreamSegment): unknown {
  if (s.type === 'text') {
    return { type: 'text', content: s.content };
  }
  return {
    type: 'clickable',
    tag: s.tag,
    content: s.content,
    attrs: Object.fromEntries(s.attrs),
  };
}

describe('MxpStreamFilter.processToSegments', () => {
  let filter: MxpStreamFilter;

  beforeEach(() => {
    filter = new MxpStreamFilter();
  });

  it('emits a single text segment for plain input', () => {
    expect(filter.processToSegments('hello').map(shape)).toEqual([
      { type: 'text', content: 'hello' },
    ]);
  });

  it('emits empty array for fully-empty result', () => {
    expect(filter.processToSegments(`${ESC}[1z<!ENTITY ap "1">${ESC}[7z`)).toEqual(
      [],
    );
  });

  it('isolates a clickable segment', () => {
    const out = filter.processToSegments('Pre <rexit>nord</rexit> Post');
    expect(out.map(shape)).toEqual([
      { type: 'text', content: 'Pre ' },
      { type: 'clickable', tag: 'rexit', content: 'nord', attrs: {} },
      { type: 'text', content: ' Post' },
    ]);
  });

  it('captures attributes on the open tag', () => {
    const out = filter.processToSegments(
      '<ircontent id="goblin">der Goblin</ircontent>',
    );
    expect(out.map(shape)).toEqual([
      {
        type: 'clickable',
        tag: 'ircontent',
        content: 'der Goblin',
        attrs: { id: 'goblin' },
      },
    ]);
  });

  it('handles a clickable scope split across chunks', () => {
    const a = filter.processToSegments('Vorne <rexit>nord');
    expect(a.map(shape)).toEqual([{ type: 'text', content: 'Vorne ' }]);
    const b = filter.processToSegments('en</rexit> Hinten');
    expect(b.map(shape)).toEqual([
      { type: 'clickable', tag: 'rexit', content: 'norden', attrs: {} },
      { type: 'text', content: ' Hinten' },
    ]);
  });

  it('preserves ANSI colour inside a clickable region', () => {
    const out = filter.processToSegments(
      `<rexit>${ESC}[33mnord${ESC}[0m</rexit>`,
    );
    const seg = out[0];
    expect(seg.type).toBe('clickable');
    if (seg.type === 'clickable') {
      expect(seg.content).toBe(`${ESC}[33mnord${ESC}[0m`);
    }
  });

  it('strips ESC[7z mode-switches inside a clickable region (workaround)', () => {
    // UNItopia's non-mudlet workaround appends ESC[7z right after the open
    // tag and right after the close tag. The resulting clickable content
    // must not contain those bytes.
    const input = `${ESC}[4z<rexit>${ESC}[7znord${ESC}[4z</rexit>${ESC}[7z`;
    const out = filter.processToSegments(input);
    expect(out.map(shape)).toEqual([
      { type: 'clickable', tag: 'rexit', content: 'nord', attrs: {} },
    ]);
  });

  it('joins multiple clickable + text segments correctly via process()', () => {
    expect(
      filter.process('a <rexit>x</rexit> b <rexit>y</rexit> c'),
    ).toBe('a x b y c');
  });

  it('treats <rshort>/<rlong>/<stat>/<sound> as non-clickable', () => {
    const input = '<rshort>Marktplatz</rshort> <rlong>...</rlong>';
    const out = filter.processToSegments(input);
    // Text-only — rshort/rlong tags are stripped but their content is kept
    // as plain text (just like in stage 1).
    expect(out.map(shape)).toEqual([
      { type: 'text', content: 'Marktplatz ...' },
    ]);
  });
});
