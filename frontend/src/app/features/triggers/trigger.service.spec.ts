import { TestBed } from '@angular/core/testing';

import { namespacedKey } from '@webmud3/frontend/shared/utils/storage-namespace';

import type { Trigger, TriggerDraft } from './models/trigger';
import { builtinSoundId } from './models/sound';
import { TriggerService } from './trigger.service';

const STORAGE_SUFFIX = 'wm3cc.triggers.v1';
const SETTINGS_SUFFIX = 'wm3cc.triggers.settings.v1';

function readStored(suffix: string): string | null {
  return localStorage.getItem(namespacedKey(suffix));
}

function highlightDraft(overrides: Partial<TriggerDraft> = {}): TriggerDraft {
  return {
    name: 'Hint',
    pattern: 'gold',
    flags: 'i',
    action: { kind: 'highlight', foreground: '#ffcc00' },
    enabled: true,
    ...overrides,
  };
}

describe('TriggerService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [TriggerService] });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('starts with an empty trigger list and default settings', () => {
    const service = TestBed.inject(TriggerService);
    expect(service.triggers).toEqual([]);
    expect(service.settings).toEqual({
      globallyEnabled: true,
      masterVolume: 1,
    });
  });

  it('creates a trigger, assigns id and timestamps, and persists it', () => {
    const service = TestBed.inject(TriggerService);

    const created = service.create(highlightDraft({ name: 'Gold' }));

    expect(created.id).toBeTruthy();
    expect(created.createdAt).toBeGreaterThan(0);
    expect(created.updatedAt).toBe(created.createdAt);
    expect(service.triggers).toHaveLength(1);

    const raw = readStored(STORAGE_SUFFIX);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toHaveLength(1);
  });

  it('rejects a trigger with an invalid regex pattern', () => {
    const service = TestBed.inject(TriggerService);
    expect(() =>
      service.create(highlightDraft({ pattern: '([unclosed' })),
    ).toThrow(/Invalid trigger pattern/);
    expect(service.triggers).toEqual([]);
  });

  it('rejects unknown regex flags', () => {
    const service = TestBed.inject(TriggerService);
    expect(() =>
      service.create(highlightDraft({ flags: 'xyz' })),
    ).toThrow(/Invalid trigger pattern/);
  });

  it('updates an existing trigger and refreshes updatedAt', () => {
    const service = TestBed.inject(TriggerService);
    const created = service.create(highlightDraft());

    // Force a different millisecond for updatedAt.
    const later = created.createdAt + 1000;
    jest.spyOn(Date, 'now').mockReturnValueOnce(later);

    const updated = service.update(created.id, { name: 'Renamed' });

    expect(updated.name).toBe('Renamed');
    expect(updated.id).toBe(created.id);
    expect(updated.updatedAt).toBe(later);
    expect(service.triggers[0].name).toBe('Renamed');
  });

  it('throws when updating an unknown id', () => {
    const service = TestBed.inject(TriggerService);
    expect(() => service.update('does-not-exist', { name: 'X' })).toThrow();
  });

  it('deletes a trigger by id and reports whether anything was removed', () => {
    const service = TestBed.inject(TriggerService);
    const created = service.create(highlightDraft());

    expect(service.delete(created.id)).toBe(true);
    expect(service.triggers).toEqual([]);
    expect(service.delete(created.id)).toBe(false);
  });

  it('reorders triggers and persists the new order', () => {
    const service = TestBed.inject(TriggerService);
    const a = service.create(highlightDraft({ name: 'A' }));
    const b = service.create(highlightDraft({ name: 'B' }));
    const c = service.create(highlightDraft({ name: 'C' }));

    service.reorder(c.id, 0);

    const names = service.triggers.map((t) => t.name);
    expect(names).toEqual(['C', 'A', 'B']);

    const stored = JSON.parse(readStored(STORAGE_SUFFIX) as string) as Trigger[];
    expect(stored.map((t) => t.name)).toEqual(['C', 'A', 'B']);
  });

  it('clamps reorder destination into the valid range', () => {
    const service = TestBed.inject(TriggerService);
    const a = service.create(highlightDraft({ name: 'A' }));
    const b = service.create(highlightDraft({ name: 'B' }));

    service.reorder(a.id, 999);
    expect(service.triggers.map((t) => t.name)).toEqual(['B', 'A']);
  });

  it('supports sound-action triggers with a namespaced sound id', () => {
    const service = TestBed.inject(TriggerService);

    const created = service.create({
      name: 'Alarm',
      pattern: 'attack',
      flags: '',
      action: { kind: 'sound', soundId: builtinSoundId('alert'), volume: 0.8 },
      enabled: true,
    });

    expect(created.action).toEqual({
      kind: 'sound',
      soundId: 'builtin:alert',
      volume: 0.8,
    });
  });

  it('reloads triggers from storage on construction', () => {
    const first = TestBed.inject(TriggerService);
    first.create(highlightDraft({ name: 'Persisted' }));

    // Re-create the DI container; the new service must see the persisted entry.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [TriggerService] });
    const second = TestBed.inject(TriggerService);

    expect(second.triggers).toHaveLength(1);
    expect(second.triggers[0].name).toBe('Persisted');
  });

  it('ignores malformed entries when loading from storage', () => {
    localStorage.setItem(
      namespacedKey(STORAGE_SUFFIX),
      JSON.stringify([
        { id: 'ok', name: 'Good', pattern: 'x', flags: '', enabled: true,
          action: { kind: 'highlight' }, createdAt: 1, updatedAt: 1 },
        { not: 'a trigger' },
        null,
      ]),
    );

    const service = TestBed.inject(TriggerService);
    expect(service.triggers).toHaveLength(1);
    expect(service.triggers[0].name).toBe('Good');
  });

  it('persists settings changes and clamps masterVolume to [0, 1]', () => {
    const service = TestBed.inject(TriggerService);

    service.setGloballyEnabled(false);
    service.setMasterVolume(5);

    expect(service.settings.globallyEnabled).toBe(false);
    expect(service.settings.masterVolume).toBe(1);

    const stored = JSON.parse(
      readStored(SETTINGS_SUFFIX) as string,
    ) as { globallyEnabled: boolean; masterVolume: number };
    expect(stored).toEqual({ globallyEnabled: false, masterVolume: 1 });
  });

  it('falls back to defaults if stored settings are corrupted', () => {
    localStorage.setItem(namespacedKey(SETTINGS_SUFFIX), '{not json');

    const service = TestBed.inject(TriggerService);
    expect(service.settings).toEqual({
      globallyEnabled: true,
      masterVolume: 1,
    });
  });
});
