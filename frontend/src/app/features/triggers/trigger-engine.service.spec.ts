import { TestBed } from '@angular/core/testing';

import { builtinSoundId } from './models/sound';
import type { TriggerDraft } from './models/trigger';
import { TriggerEngineService } from './trigger-engine.service';
import { TriggerService } from './trigger.service';

const ESC = '\x1b';

function highlight(overrides: Partial<TriggerDraft> = {}): TriggerDraft {
  return {
    name: 'Test',
    pattern: 'gold',
    flags: 'g',
    action: { kind: 'highlight', foreground: '#ff0' },
    enabled: true,
    ...overrides,
  };
}

function sound(overrides: Partial<TriggerDraft> = {}): TriggerDraft {
  return {
    name: 'Alarm',
    pattern: 'attack',
    flags: 'i',
    action: { kind: 'sound', soundId: builtinSoundId('alert'), volume: 0.7 },
    enabled: true,
    ...overrides,
  };
}

describe('TriggerEngineService', () => {
  let triggers: TriggerService;
  let engine: TriggerEngineService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    triggers = TestBed.inject(TriggerService);
    engine = TestBed.inject(TriggerEngineService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns the original text when no triggers are configured', () => {
    const result = engine.processChunk('hello world');
    expect(result.text).toBe('hello world');
    expect(result.sounds).toEqual([]);
  });

  it('injects ANSI highlights for a matching pattern', () => {
    triggers.create(highlight({ pattern: 'world' }));

    const result = engine.processChunk('hello world!');
    expect(result.text).toBe(
      `hello ${ESC}[38;2;255;255;0mworld${ESC}[0m!`,
    );
    expect(result.sounds).toEqual([]);
  });

  it('matches against the visible text and preserves surrounding ANSI codes', () => {
    triggers.create(highlight({ pattern: 'green' }));

    const input = `${ESC}[31mred${ESC}[32mgreen${ESC}[34mblue${ESC}[0m`;
    const result = engine.processChunk(input);

    expect(result.text).toBe(
      `${ESC}[31mred${ESC}[32m${ESC}[38;2;255;255;0mgreen${ESC}[0m${ESC}[34mblue${ESC}[0m`,
    );
  });

  it('queues sounds for sound-action triggers', () => {
    triggers.create(sound({ pattern: 'attacks you' }));

    const result = engine.processChunk('A goblin attacks you fiercely.');
    expect(result.text).toBe('A goblin attacks you fiercely.');
    expect(result.sounds).toEqual([
      { soundId: 'builtin:alert', volume: 0.7 },
    ]);
  });

  it('respects the per-trigger global enabled flag', () => {
    triggers.create(highlight({ pattern: 'gold', enabled: false }));

    const result = engine.processChunk('found gold');
    expect(result.text).toBe('found gold');
  });

  it('is a no-op when triggers are globally disabled', () => {
    triggers.create(highlight({ pattern: 'gold' }));
    triggers.setGloballyEnabled(false);

    const result = engine.processChunk('found gold');
    expect(result.text).toBe('found gold');
    expect(result.sounds).toEqual([]);
  });

  it('drops overlapping highlights — earlier trigger wins', () => {
    triggers.create(highlight({ name: 'A', pattern: 'abcd', action: { kind: 'highlight', foreground: '#f00' } }));
    triggers.create(highlight({ name: 'B', pattern: 'bcde', action: { kind: 'highlight', foreground: '#0f0' } }));

    const result = engine.processChunk('xabcdefy');
    // Only "abcd" survives, "bcde" overlap is dropped.
    expect(result.text).toBe(
      `x${ESC}[38;2;255;0;0mabcd${ESC}[0mefy`,
    );
  });

  it('collects multiple matches per trigger with the g flag', () => {
    triggers.create(sound({ pattern: 'hit', flags: 'g' }));

    const result = engine.processChunk('hit hit hit');
    expect(result.sounds).toHaveLength(3);
  });

  it('caps matches per trigger at the safety limit', () => {
    triggers.create(sound({ pattern: 'x', flags: 'g' }));
    const longInput = 'x'.repeat(100);

    const result = engine.processChunk(longInput);
    expect(result.sounds.length).toBeLessThanOrEqual(32);
  });

  it('does not loop forever on a zero-width regex', () => {
    triggers.create(highlight({ pattern: 'a?', flags: 'g' }));

    // Without the zero-width guard this would never return.
    const result = engine.processChunk('aaa');
    expect(result.text.length).toBeGreaterThan(0);
  });

  it('case-insensitive flag is honoured', () => {
    triggers.create(highlight({ pattern: 'gold', flags: 'i' }));

    const result = engine.processChunk('found GOLD!');
    expect(result.text).toContain('GOLD');
    // The match wraps GOLD, not "gold".
    expect(result.text).toBe(
      `found ${ESC}[38;2;255;255;0mGOLD${ESC}[0m!`,
    );
  });

  it('reflects later trigger edits via the reactive cache', () => {
    const t = triggers.create(highlight({ pattern: 'gold' }));

    let result = engine.processChunk('gold');
    expect(result.text).toContain('38;2;255;255;0m');

    triggers.update(t.id, { pattern: 'silver' });

    result = engine.processChunk('gold');
    expect(result.text).toBe('gold');

    result = engine.processChunk('silver');
    expect(result.text).toContain('38;2;255;255;0m');
  });
});
