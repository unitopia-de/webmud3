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

  it('strips a simple MXP open/close tag pair when in secure mode', () => {
    expect(
      filter.process(
        `${ESC}[1zHier: <rexit>norden</rexit> raus.${ESC}[7z`,
      ),
    ).toBe('Hier: norden raus.');
  });

  it('leaves angle brackets alone in locked mode (default)', () => {
    // Regression test: a `cat foo.c` showing `#include <stdio.h>` used to
    // lose the `<stdio.h>` because the filter parsed every `<…>` as an
    // MXP tag regardless of mode. UNItopia wraps real MXP with
    // `ESC[4z…ESC[7z`, so plain content stays in locked mode and `<`
    // must be literal there.
    expect(filter.process('#include <stdio.h>\n')).toBe(
      '#include <stdio.h>\n',
    );
    expect(filter.process('#include <sys/stat.h>\n')).toBe(
      '#include <sys/stat.h>\n',
    );
    expect(filter.process('using std::vector;\nstd::vector<int> v;\n')).toBe(
      'using std::vector;\nstd::vector<int> v;\n',
    );
  });

  it('strips !ELEMENT and !ENTITY declarations', () => {
    const input =
      `${ESC}[1z<!ELEMENT rlong '' FLAG=RoomDesc>` +
      `<!ENTITY ap "100" PUBLISH>${ESC}[7z`;
    expect(filter.process(input)).toBe('');
  });

  it('honours quoted attributes that contain a >', () => {
    const input = `${ESC}[1z<send href="a > b">click</send>${ESC}[7z`;
    expect(filter.process(input)).toBe('click');
  });

  it('keeps ordinary < followed by digit/space as plain text', () => {
    // The "1 < 2" case must not trigger tag swallowing.
    expect(filter.process('Vergleich: 1 < 2 ist wahr.')).toBe(
      'Vergleich: 1 < 2 ist wahr.',
    );
    // < followed by a letter is treated as a tag start, but only when
    // we're in MXP secure mode.
    expect(
      filter.process(`${ESC}[1zTest <abc>X</abc> done${ESC}[7z`),
    ).toBe('Test X done');
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
    expect(filter.process(`${ESC}[1zDrinnen: <rex`)).toBe('Drinnen: ');
    expect(filter.process(`it>nord</rexit> da${ESC}[7z`)).toBe('nord da');
  });

  it('handles a tag whose < is the very last byte of a chunk', () => {
    expect(filter.process(`${ESC}[1zText <`)).toBe('Text ');
    expect(filter.process(`rshort>X</rshort>!${ESC}[7z`)).toBe('X!');
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
    const input =
      `${ESC}[33mDu siehst hier:${ESC}[0m ${ESC}[4z<ircontent id="schwert">ein Schwert</ircontent>${ESC}[7z.`;
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
      f.process(
        `${ESC}[1z<!ENTITY ap "100" PUBLISH><stat ap max=maxap caption="AP:">Hello${ESC}[7z`,
      );
      expect(seen).toEqual([
        '<!ENTITY ap "100" PUBLISH>',
        '<stat ap max=maxap caption="AP:">',
      ]);
    });

    it('emits a tag only after it is complete (across chunks)', () => {
      const seen: string[] = [];
      const f = new MxpStreamFilter((raw) => seen.push(raw));
      f.process(`${ESC}[1z<!ENTITY ap `);
      expect(seen).toEqual([]);
      f.process(`"100" PUBLISH>tail${ESC}[7z`);
      expect(seen).toEqual(['<!ENTITY ap "100" PUBLISH>']);
    });

    it('still strips the tag bytes from the output', () => {
      const seen: string[] = [];
      const f = new MxpStreamFilter((raw) => seen.push(raw));
      const out = f.process(`Pre ${ESC}[4z<stat foo>${ESC}[7zPost`);
      expect(out).toBe('Pre Post');
      expect(seen).toEqual(['<stat foo>']);
    });
  });
});
