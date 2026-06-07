import { MxpStatService } from './mxp-stat.service';

describe('MxpStatService', () => {
  let svc: MxpStatService;

  beforeEach(() => {
    svc = new MxpStatService();
  });

  it('starts with no stats', () => {
    expect(svc.stats).toEqual([]);
  });

  it('appends a new stat', () => {
    svc.upsert({ name: 'ap', maxName: 'maxap', caption: 'AP:' });
    expect(svc.stats).toHaveLength(1);
    expect(svc.stats[0]).toEqual({
      name: 'ap',
      maxName: 'maxap',
      caption: 'AP:',
    });
  });

  it('replaces an existing stat by name (no duplicate)', () => {
    svc.upsert({ name: 'ap', caption: 'AP:' });
    svc.upsert({ name: 'ap', caption: 'Aktionspunkte:' });
    expect(svc.stats).toHaveLength(1);
    expect(svc.stats[0].caption).toBe('Aktionspunkte:');
  });

  it('keeps distinct stats separate', () => {
    svc.upsert({ name: 'ap', caption: 'AP:' });
    svc.upsert({ name: 'zp', caption: 'LP:' });
    expect(svc.stats.map((s) => s.name)).toEqual(['ap', 'zp']);
  });

  it('does not emit when an identical definition is re-sent', () => {
    svc.upsert({ name: 'ap', maxName: 'maxap', caption: 'AP:' });
    let emissions = 0;
    const sub = svc.stats$.subscribe(() => (emissions += 1));
    emissions = 0; // ignore replay
    svc.upsert({ name: 'ap', maxName: 'maxap', caption: 'AP:' });
    expect(emissions).toBe(0);
    sub.unsubscribe();
  });

  it('clears all stats', () => {
    svc.upsert({ name: 'ap' });
    svc.clear();
    expect(svc.stats).toEqual([]);
  });
});
