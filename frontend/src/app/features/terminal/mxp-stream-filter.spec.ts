import { MxpStreamFilter } from './mxp-stream-filter';

const ESC = '\u001b';

describe('MxpStreamFilter', () => {
  let filter: MxpStreamFilter;

  beforeEach(() => {
    filter = new MxpStreamFilter();
  });

  it('passes plain text through unchanged', () => {
    expect(filter.process('Hello world\r\n')).toBe('Hello world\r\n');
  });

  it('preserves ANSI colour escapes', () => {
    const input = `${ESC}[33mHello${ESC}[0m`;
    expect(filter.process(input)).toBe(input);
  });

  it('strips MXP mode-switch sequences', () => {
    expect(filter.process(`${ESC}[1zHello${ESC}[7z`)).toBe('Hello');
    expect(filter.process(`${ESC}[4zX`)).toBe('X');
  });

  it('strips a simple MXP open/close tag pair', () => {
    expect(filter.process('Hier: <rexit>norden</rexit> raus.')).toBe(
      'Hier: norden raus.',
    );
  });

  it('strips !ELEMENT and !ENTITY declarations', () => {
    const input =
      `${ESC}[1z<!ELEMENT rlong '' FLAG=RoomDesc>` +
      `<!ENTITY ap "100" PUBLISH>${ESC}[7z`;
    expect(filter.process(input)).toBe('');
  });

  it('honours quoted attributes that contain a >', () => {
    const input = `<send href="a > b">click</send>`;
    expect(filter.process(input)).toBe('click');
  });

  it('keeps ordinary < followed by digit/space as plain text', () => {
    // The "1 < 2" case must not trigger tag swallowing.
    expect(filter.process('Vergleich: 1 < 2 ist wahr.')).toBe(
      'Vergleich: 1 < 2 ist wahr.',
    );
    // But < followed by a letter is treated as a tag start.
    expect(filter.process('Test <abc>X</abc> done')).toBe('Test X done');
  });

  it('preserves & and entity references untouched', () => {
    // Stage 1 does not interpret &id; — it just must not eat them.
    expect(filter.process('Click &id; here')).toBe('Click &id; here');
  });

  it('preserves a stand-alone ESC that is not a CSI', () => {
    // A bare ESC followed by a non-`[` character should pass through.
    expect(filter.process(`${ESC}c`)).toBe(`${ESC}c`);
  });

  it('passes ESC[<digits>m (colour) through unchanged', () => {
    expect(filter.process(`${ESC}[31mred${ESC}[0m`)).toBe(
      `${ESC}[31mred${ESC}[0m`,
    );
  });

  it('handles a CSI sequence split across two chunks', () => {
    expect(filter.process(`${ESC}[`)).toBe('');
    expect(filter.process(`1zHello`)).toBe('Hello');
  });

  it('handles an MXP tag split across two chunks', () => {
    expect(filter.process('Drinnen: <rex')).toBe('Drinnen: ');
    expect(filter.process('it>nord</rexit> da')).toBe('nord da');
  });

  it('handles a tag whose < is the very last byte of a chunk', () => {
    expect(filter.process('Text <')).toBe('Text ');
    expect(filter.process('rshort>X</rshort>!')).toBe('X!');
  });

  it('keeps the buffer empty after a complete clean run', () => {
    filter.process(`${ESC}[1z<rshort>Z</rshort>${ESC}[7z`);
    // Next chunk should not pick up any leftover state.
    expect(filter.process('plain')).toBe('plain');
  });

  it('reset() drops any pending partial input', () => {
    filter.process(`${ESC}[`); // partial CSI
    filter.reset();
    expect(filter.process('hello')).toBe('hello');
  });

  it('strips the full UNItopia init push', () => {
    // Realistic excerpt of what the server sends in init_mxp().
    const input =
      `${ESC}[1z<!ELEMENT rlong '' FLAG=RoomDesc>` +
      `<!ELEMENT rshort '' FLAG=RoomName>` +
      `<!ELEMENT rexit '<send expire="room">' FLAG=RoomExit>` +
      `<stat ap max=maxap caption="AP:">` +
      `<sound Off U="https://www.unitopia.de/sound">` +
      `${ESC}[7z`;
    expect(filter.process(input)).toBe('');
  });

  it('strips inline tags mixed with normal text and ANSI', () => {
    const input = `${ESC}[33mDu siehst hier:${ESC}[0m <ircontent id="schwert">ein Schwert</ircontent>.`;
    expect(filter.process(input)).toBe(
      `${ESC}[33mDu siehst hier:${ESC}[0m ein Schwert.`,
    );
  });

  it('handles the workaround-mode pattern (ESC[7z after every tag)', () => {
    // UNItopia appends `ESC[7z` after each MXP tag for non-mudlet clients.
    const input =
      `${ESC}[4z<rshort>X</rshort>${ESC}[7z` +
      `Plain text.${ESC}[4z<rexit>nord</rexit>${ESC}[7z`;
    expect(filter.process(input)).toBe('XPlain text.nord');
  });

  describe('with onTag callback', () => {
    it('emits each complete tag verbatim', () => {
      const seen: string[] = [];
      const f = new MxpStreamFilter((raw) => seen.push(raw));
      f.process(`<!ENTITY ap "100" PUBLISH><stat ap max=maxap caption="AP:">Hello`);
      expect(seen).toEqual([
        '<!ENTITY ap "100" PUBLISH>',
        '<stat ap max=maxap caption="AP:">',
      ]);
    });

    it('emits a tag only after it is complete (across chunks)', () => {
      const seen: string[] = [];
      const f = new MxpStreamFilter((raw) => seen.push(raw));
      f.process('<!ENTITY ap ');
      expect(seen).toEqual([]);
      f.process('"100" PUBLISH>tail');
      expect(seen).toEqual(['<!ENTITY ap "100" PUBLISH>']);
    });

    it('still strips the tag bytes from the output', () => {
      const seen: string[] = [];
      const f = new MxpStreamFilter((raw) => seen.push(raw));
      const out = f.process('Pre <stat foo>Post');
      expect(out).toBe('Pre Post');
      expect(seen).toEqual(['<stat foo>']);
    });
  });
});
