import { TestBed } from '@angular/core/testing';

import { MxpElementService } from './mxp-element.service';

describe('MxpElementService', () => {
  let svc: MxpElementService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(MxpElementService);
  });

  it('stores and retrieves a definition by name (case-insensitive)', () => {
    svc.define({
      name: 'rexit',
      template: `<send expire="room">`,
      flag: 'RoomExit',
    });
    expect(svc.get('rexit')).toBeDefined();
    expect(svc.get('REXIT')).toBeDefined();
  });

  describe('resolve()', () => {
    it('returns null for unknown elements', () => {
      const out = svc.resolve('rexit', new Map());
      expect(out).toBeNull();
    });

    it('returns null when the template has no <send>', () => {
      svc.define({ name: 'rshort', template: '' });
      const out = svc.resolve('rshort', new Map());
      expect(out).toBeNull();
    });

    it('extracts href and expire from a static <send>', () => {
      svc.define({
        name: 'rexit',
        template: `<send expire="room">`,
      });
      // rexit's template has no `href` attribute — UNItopia expects the
      // tag *content* to be used as the command. resolve() returns null
      // because there is no href.
      const out = svc.resolve('rexit', new Map());
      expect(out).toBeNull();
    });

    it('substitutes &id; entity references with attribute values', () => {
      svc.define({
        name: 'ircontent',
        template: `<send href="betrachte &id;|nimm &id;" expire="room">`,
        attNames: ['id'],
      });
      const attrs = new Map([['id', 'goblin']]);
      const out = svc.resolve('ircontent', attrs)!;
      expect(out.href).toBe('betrachte goblin|nimm goblin');
      expect(out.expire).toBe('room');
    });

    it('handles single-quoted href values', () => {
      svc.define({
        name: 'ircontent',
        template: `<send href='click &id;'>`,
      });
      const out = svc.resolve('ircontent', new Map([['id', 'x']]))!;
      expect(out.href).toBe('click x');
    });

    it('expands missing entities to empty strings', () => {
      svc.define({
        name: 'ircontent',
        template: `<send href="hi &missing;">`,
      });
      const out = svc.resolve('ircontent', new Map())!;
      expect(out.href).toBe('hi ');
    });
  });

  it('clear() drops every definition', () => {
    svc.define({ name: 'rexit', template: `<send expire="room">` });
    svc.clear();
    expect(svc.get('rexit')).toBeUndefined();
  });
});
