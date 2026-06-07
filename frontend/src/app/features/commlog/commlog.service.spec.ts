import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';

import { MudSignalService } from '@webmud3/frontend/features/gmcp/signals/mud-signal.service';
import { channelLabel, CommlogService } from './commlog.service';

describe('channelLabel', () => {
  it('maps known channels to German labels', () => {
    expect(channelLabel('Say')).toBe('sage');
    expect(channelLabel('Soul')).toBe('seele');
    expect(channelLabel('Tell')).toBe('rede');
  });

  it('falls back to the raw name for unknown channels', () => {
    expect(channelLabel('Shout')).toBe('Shout');
  });
});

describe('CommlogService', () => {
  let comm: Subject<{ channel: string; data: unknown }>;
  let svc: CommlogService;

  beforeEach(() => {
    comm = new Subject();
    const signals = {
      on: (name: string) => (name === 'Comm.Message' ? comm : new Subject()),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: MudSignalService, useValue: signals as unknown as MudSignalService },
      ],
    });
    svc = TestBed.inject(CommlogService);
  });

  afterEach(() => TestBed.resetTestingModule());

  function say(player: string, text: string, channel = 'Say') {
    comm.next({ channel, data: { player, text } });
  }

  it('collects incoming messages into the buffer', () => {
    say('Boronx', 'Hallo');
    say('Merlin', 'Tag', 'Tell');

    const entries = svc.entries();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      channel: 'Say',
      player: 'Boronx',
      text: 'Hallo',
    });
    expect(entries[1]).toMatchObject({ channel: 'Tell', player: 'Merlin' });
  });

  it('falls back to "-" / empty for missing fields', () => {
    comm.next({ channel: 'Say', data: {} });
    expect(svc.entries()[0]).toMatchObject({ player: '-', text: '' });
  });

  it('clear empties the buffer', () => {
    say('A', 'x');
    svc.clear();
    expect(svc.entries()).toEqual([]);
  });

  it('toText renders one labelled line per message', () => {
    say('Boronx', 'Hallo');
    const text = svc.toText();
    expect(text).toContain('(sage) Boronx: Hallo');
  });

  it('caps the buffer at 5000 entries (oldest dropped)', () => {
    for (let i = 0; i < 5001; i++) {
      say('P', `m${i}`);
    }
    const entries = svc.entries();
    expect(entries).toHaveLength(5000);
    // m0 was evicted; the window starts at m1 and ends at m5000.
    expect(entries[0].text).toBe('m1');
    expect(entries[entries.length - 1].text).toBe('m5000');
  });

  it('stops collecting after destroy', () => {
    svc.ngOnDestroy();
    say('A', 'x');
    expect(svc.entries()).toEqual([]);
  });
});
