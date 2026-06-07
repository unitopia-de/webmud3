import { MxpEntityService } from './mxp-entity.service';

describe('MxpEntityService', () => {
  let svc: MxpEntityService;

  beforeEach(() => {
    svc = new MxpEntityService();
  });

  it('starts empty', () => {
    expect(svc.get('ap')).toBeUndefined();
  });

  it('stores and reads an entity', () => {
    svc.set('ap', '42');
    expect(svc.get('ap')).toBe('42');
  });

  it('emits a fresh map whenever a value changes', () => {
    const seen: ReadonlyMap<string, string>[] = [];
    const sub = svc.entities$.subscribe((m) => seen.push(m));

    svc.set('ap', '1');
    svc.set('ap', '2');

    // initial empty + two updates
    expect(seen).toHaveLength(3);
    expect(seen[2].get('ap')).toBe('2');
    // Each emission is a distinct map instance (immutability).
    expect(seen[1]).not.toBe(seen[2]);
    sub.unsubscribe();
  });

  it('is a no-op (no emission) when the value is unchanged', () => {
    svc.set('ap', '5');
    let emissions = 0;
    const sub = svc.entities$.subscribe(() => (emissions += 1));
    emissions = 0; // ignore the replay of the current value

    svc.set('ap', '5');
    expect(emissions).toBe(0);
    sub.unsubscribe();
  });

  it('clears all entities', () => {
    svc.set('ap', '5');
    svc.clear();
    expect(svc.get('ap')).toBeUndefined();
  });

  it('clear is a no-op when already empty (no emission)', () => {
    let emissions = 0;
    const sub = svc.entities$.subscribe(() => (emissions += 1));
    emissions = 0;
    svc.clear();
    expect(emissions).toBe(0);
    sub.unsubscribe();
  });
});
