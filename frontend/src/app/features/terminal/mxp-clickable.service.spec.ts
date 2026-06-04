import { TestBed } from '@angular/core/testing';

import { ClickAction, MxpClickableService } from './mxp-clickable.service';

describe('MxpClickableService', () => {
  let svc: MxpClickableService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(MxpClickableService);
  });

  function simple(command: string): ClickAction {
    return { kind: 'simple', command };
  }

  it('register / lookup round-trip', () => {
    const id = svc.register(simple('nord'), 'nord');
    const r = svc.lookup(id);
    expect(r?.label).toBe('nord');
    expect(r?.action).toEqual(simple('nord'));
  });

  it('lookup returns null for unknown id', () => {
    expect(svc.lookup(999)).toBeNull();
  });

  it('expireDomain("room") invalidates regions registered before the bump', () => {
    const oldId = svc.register(simple('nord'), 'nord', 'room');
    svc.expireDomain('room');
    const newId = svc.register(simple('sued'), 'sued', 'room');

    expect(svc.lookup(oldId)).toBeNull();
    expect(svc.lookup(newId)?.label).toBe('sued');
  });

  it('regions without expireDomain survive a room bump', () => {
    const id = svc.register(simple('inv'), 'inv'); // no domain
    svc.expireDomain('room');
    expect(svc.lookup(id)?.label).toBe('inv');
  });

  it('evicts stale room regions from the store so the Map stays bounded', () => {
    // Simulate many rooms, each registering exits, then moving on.
    for (let room = 0; room < 50; room++) {
      svc.register(simple('nord'), 'nord', 'room');
      svc.register(simple('sued'), 'sued', 'room');
      svc.expireDomain('room'); // player leaves the room
    }
    // After 50 room transitions only the just-expired room's (now stale)
    // entries must not accumulate: the store should be empty, not holding
    // 100 dead regions.
    expect(svc._all().length).toBe(0);

    // A fresh room's links are retained until the next bump.
    svc.register(simple('ost'), 'ost', 'room');
    expect(svc._all().length).toBe(1);
  });

  it('keeps non-room regions while evicting stale room regions on a bump', () => {
    const keep = svc.register(simple('inv'), 'inv'); // no domain, immortal
    svc.register(simple('nord'), 'nord', 'room');
    svc.expireDomain('room');

    const remaining = svc._all();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(keep);
  });

  it('expireDomain for a non-room domain drops matching regions outright', () => {
    const a = svc.register(simple('a'), 'a', 'custom');
    const b = svc.register(simple('b'), 'b'); // no domain
    svc.expireDomain('custom');
    expect(svc.lookup(a)).toBeNull();
    expect(svc.lookup(b)?.label).toBe('b');
  });

  it('clear empties the store and resets ids + epoch', () => {
    const id1 = svc.register(simple('a'), 'a');
    expect(id1).toBe(1);
    svc.expireDomain('room');
    expect(svc._currentEpoch()).toBe(1);

    svc.clear();
    expect(svc.lookup(id1)).toBeNull();
    expect(svc._currentEpoch()).toBe(0);
    const id2 = svc.register(simple('a'), 'a');
    expect(id2).toBe(1);
  });
});
