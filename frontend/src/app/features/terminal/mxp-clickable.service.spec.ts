import { TestBed } from '@angular/core/testing';

import {
  ClickAction,
  LineMarker,
  MxpClickableService,
} from './mxp-clickable.service';

describe('MxpClickableService', () => {
  let svc: MxpClickableService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(MxpClickableService);
  });

  function staticMarker(line: number): LineMarker {
    return { line };
  }

  function simple(command: string): ClickAction {
    return { kind: 'simple', command };
  }

  it('register returns null for a zero-width region', () => {
    const r = svc.register(staticMarker(5), 0, 0, simple('x'), 'x');
    expect(r).toBeNull();
  });

  it('regionsForLine matches the marker line', () => {
    svc.register(staticMarker(3), 0, 5, simple('nord'), 'nord');
    svc.register(staticMarker(4), 0, 5, simple('ost'), 'ost');
    expect(svc.regionsForLine(3).map((r) => r.label)).toEqual(['nord']);
    expect(svc.regionsForLine(4).map((r) => r.label)).toEqual(['ost']);
    expect(svc.regionsForLine(5).map((r) => r.label)).toEqual([]);
  });

  it('skips regions whose marker has scrolled out (line < 0)', () => {
    svc.register(staticMarker(-1), 0, 5, simple('lost'), 'lost');
    expect(svc.regionsForLine(-1)).toEqual([]);
  });

  it('expireDomain marks matching regions inactive', () => {
    svc.register(staticMarker(0), 0, 4, simple('a'), 'a', 'room');
    svc.register(staticMarker(0), 5, 9, simple('b'), 'b', 'room');
    svc.register(staticMarker(0), 10, 14, simple('c'), 'c'); // no domain

    expect(svc.regionsForLine(0).length).toBe(3);
    svc.expireDomain('room');
    expect(svc.regionsForLine(0).map((r) => r.label)).toEqual(['c']);
  });

  it('clear empties the store and resets ids', () => {
    const r1 = svc.register(staticMarker(0), 0, 4, simple('a'), 'a')!;
    expect(r1.id).toBe(1);
    svc.clear();
    expect(svc.regionsForLine(0)).toEqual([]);
    const r2 = svc.register(staticMarker(0), 0, 4, simple('a'), 'a')!;
    expect(r2.id).toBe(1);
  });
});
