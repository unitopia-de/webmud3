import { TestBed } from '@angular/core/testing';

import { MudService } from '@webmud3/frontend/core/mud/services/mud.service';
import { namespacedKey } from '@webmud3/frontend/shared/utils/storage-namespace';
import {
  isNumpadCode,
  NumpadModifiers,
  NumpadService,
  numpadLayerId,
} from './numpad.service';

const KEY = namespacedKey('webmud3-numpad-bindings');

const NO_MODS: NumpadModifiers = {
  shift: false,
  ctrl: false,
  alt: false,
  meta: false,
};

function keyEvent(
  code: string,
  mods: Partial<NumpadModifiers> = {},
): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    code,
    shiftKey: mods.shift ?? false,
    ctrlKey: mods.ctrl ?? false,
    altKey: mods.alt ?? false,
    metaKey: mods.meta ?? false,
  });
}

describe('numpad pure helpers', () => {
  it('numpadLayerId builds canonical ids in fixed order', () => {
    expect(numpadLayerId(NO_MODS)).toBe('');
    expect(numpadLayerId({ ...NO_MODS, shift: true })).toBe('Shift');
    expect(
      numpadLayerId({ shift: true, ctrl: true, alt: false, meta: false }),
    ).toBe('ShiftCtrl');
    expect(
      numpadLayerId({ shift: true, ctrl: true, alt: true, meta: true }),
    ).toBe('ShiftCtrlAltMeta');
  });

  it('isNumpadCode recognises numpad codes only', () => {
    expect(isNumpadCode('Numpad8')).toBe(true);
    expect(isNumpadCode('NumpadEnter')).toBe(true);
    expect(isNumpadCode('KeyA')).toBe(false);
  });
});

describe('NumpadService', () => {
  let sendMessage: jest.Mock;

  function inject(): NumpadService {
    return TestBed.inject(NumpadService);
  }

  beforeEach(() => {
    localStorage.clear();
    sendMessage = jest.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: MudService, useValue: { sendMessage } as unknown as MudService },
      ],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('ships sensible default bindings in the no-modifier layer', () => {
    const svc = inject();
    expect(svc.getCommand('Numpad8', NO_MODS)).toBe('norden');
    expect(svc.getCommand('Numpad2', NO_MODS)).toBe('sueden');
    expect(svc.getCommand('Numpad5', NO_MODS)).toBe('schau');
  });

  it('setBinding adds, overwrites and (empty) removes — dropping empty layers', () => {
    const svc = inject();
    svc.setBinding('Shift', 'Numpad8', 'lauf norden');
    expect(svc.getCommand('Numpad8', { ...NO_MODS, shift: true })).toBe(
      'lauf norden',
    );

    svc.setBinding('Shift', 'Numpad8', '');
    expect(svc.getCommand('Numpad8', { ...NO_MODS, shift: true })).toBeUndefined();
    // Layer became empty → removed entirely.
    expect(svc.bindingsForLayer('Shift')).toEqual({});
  });

  it('persists to localStorage and reloads in a fresh instance', () => {
    inject().setBinding('', 'NumpadDecimal', 'winke');
    expect(localStorage.getItem(KEY)).toContain('winke');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: MudService, useValue: { sendMessage } as unknown as MudService },
      ],
    });
    expect(TestBed.inject(NumpadService).getCommand('NumpadDecimal', NO_MODS)).toBe(
      'winke',
    );
  });

  it('migrates a legacy flat layout into the no-modifier layer', () => {
    localStorage.setItem(KEY, JSON.stringify({ Numpad8: 'hoch' }));
    expect(inject().getCommand('Numpad8', NO_MODS)).toBe('hoch');
  });

  it('resetToDefaults restores the built-in bindings', () => {
    const svc = inject();
    svc.setBinding('', 'Numpad8', 'foo');
    svc.resetToDefaults();
    expect(svc.getCommand('Numpad8', NO_MODS)).toBe('norden');
  });

  it('trigger sends the bound command to the MUD', () => {
    inject().trigger('Numpad8');
    expect(sendMessage).toHaveBeenCalledWith('norden');
  });

  it('trigger is a no-op when unbound', () => {
    inject().trigger('NumpadEnter');
    expect(sendMessage).not.toHaveBeenCalled();
  });

  describe('triggerFromEvent', () => {
    it('returns null for a non-numpad key', () => {
      expect(inject().triggerFromEvent(keyEvent('KeyA'))).toBeNull();
    });

    it('sends and returns the command for a bound numpad key', () => {
      const svc = inject();
      expect(svc.triggerFromEvent(keyEvent('Numpad8'))).toBe('norden');
      expect(sendMessage).toHaveBeenCalledWith('norden');
    });

    it('ignores AltGr (physical Ctrl+Alt only)', () => {
      const svc = inject();
      svc.setBinding('CtrlAlt', 'Numpad8', 'should-not-fire');
      expect(
        svc.triggerFromEvent(keyEvent('Numpad8', { ctrl: true, alt: true })),
      ).toBeNull();
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('resolves the layer from physical modifiers', () => {
      const svc = inject();
      svc.setBinding('Shift', 'Numpad8', 'renne norden');
      expect(
        svc.triggerFromEvent(keyEvent('Numpad8', { shift: true })),
      ).toBe('renne norden');
    });

    it('OR-s extraMods with the event modifiers (config checkboxes)', () => {
      const svc = inject();
      svc.setBinding('Shift', 'Numpad8', 'renne norden');
      // No physical shift, but the extraMods supplies it.
      expect(
        svc.triggerFromEvent(keyEvent('Numpad8'), { shift: true }),
      ).toBe('renne norden');
    });
  });
});
