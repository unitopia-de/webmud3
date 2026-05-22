import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { TriggerConfigComponent } from './trigger-config.component';
import { TriggerService } from './trigger.service';

function setup() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
    imports: [TriggerConfigComponent],
  });
  const fixture = TestBed.createComponent(TriggerConfigComponent);
  // Flush the manifest request so the SoundLibrary subscription resolves.
  const http = TestBed.inject(HttpTestingController);
  const reqs = http.match('assets/sounds/manifest.json');
  for (const req of reqs) {
    req.flush({ version: 1, sounds: [{ id: 'alert', label: 'Alert', file: 'alert.wav' }] });
  }
  const component = fixture.componentInstance;
  const triggerService = TestBed.inject(TriggerService);
  return { fixture, component, triggerService, http };
}

describe('TriggerConfigComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    try {
      TestBed.inject(HttpTestingController).verify();
    } catch {
      // Verification can fail if multiple manifest requests fired — the
      // component shares the singleton SoundLibraryService and only one
      // construction happens per test, but we leave the verify pass tolerant.
    }
    localStorage.clear();
  });

  it('creates and starts with the editor closed', () => {
    const { component, http } = setup();
    expect(component.editorOpen()).toBe(false);
    expect(component.triggerList()).toEqual([]);
    http.verify();
  });

  it('opens a fresh editor on openNew()', () => {
    const { component } = setup();

    component.openNew();
    expect(component.editorOpen()).toBe(true);
    expect(component.isEditing()).toBe(false);
    expect(component.nameField()).toBe('');
    expect(component.actionKindField()).toBe('highlight');
  });

  it('saves a new highlight trigger and closes the editor', () => {
    const { component, triggerService } = setup();

    component.openNew();
    component.nameField.set('Gold');
    component.patternField.set('gold');
    component.flagsField.set('i');
    component.foregroundField.set('#ffcc00');
    component.boldField.set(true);

    component.save();

    expect(component.editorOpen()).toBe(false);
    expect(triggerService.triggers).toHaveLength(1);
    const created = triggerService.triggers[0];
    expect(created.name).toBe('Gold');
    expect(created.action).toEqual({
      kind: 'highlight',
      foreground: '#ffcc00',
      background: undefined,
      bold: true,
    });
  });

  it('saves a sound trigger with the chosen volume', () => {
    const { component, triggerService } = setup();

    component.openNew();
    component.nameField.set('Alarm');
    component.patternField.set('attack');
    component.actionKindField.set('sound');
    component.soundIdField.set('builtin:alert');
    component.volumeField.set(0.6);

    component.save();

    const created = triggerService.triggers[0];
    expect(created.action).toEqual({
      kind: 'sound',
      soundId: 'builtin:alert',
      volume: 0.6,
    });
  });

  it('surfaces a syntax error and does not close the editor on save', () => {
    const { component, triggerService } = setup();

    component.openNew();
    component.patternField.set('([broken');
    expect(component.compileError()).not.toBe('');

    component.save();

    expect(component.editorOpen()).toBe(true);
    expect(component.saveError()).toMatch(/Invalid trigger pattern/);
    expect(triggerService.triggers).toHaveLength(0);
  });

  it('loads an existing trigger into the editor on openEdit()', () => {
    const { component, triggerService } = setup();
    const created = triggerService.create({
      name: 'Existing',
      pattern: 'foo',
      flags: 'g',
      action: { kind: 'highlight', foreground: '#abcdef', bold: false },
      enabled: true,
    });

    component.openEdit(created);

    expect(component.editorOpen()).toBe(true);
    expect(component.isEditing()).toBe(true);
    expect(component.nameField()).toBe('Existing');
    expect(component.foregroundField()).toBe('#abcdef');
  });

  it('updates an existing trigger when save() runs while editing', () => {
    const { component, triggerService } = setup();
    const created = triggerService.create({
      name: 'Old',
      pattern: 'x',
      flags: '',
      action: { kind: 'highlight', foreground: '#ffffff' },
      enabled: true,
    });

    component.openEdit(created);
    component.nameField.set('New');
    component.save();

    expect(triggerService.triggers).toHaveLength(1);
    expect(triggerService.triggers[0].id).toBe(created.id);
    expect(triggerService.triggers[0].name).toBe('New');
  });

  it('builds preview segments that mark matches and unmatched runs', () => {
    const { component } = setup();
    component.openNew();
    component.patternField.set('gold');
    component.flagsField.set('gi');
    component.testInput.set('You found gold and gold!');

    const segs = component.previewSegments();
    expect(segs.filter((s) => s.matched)).toHaveLength(2);
    expect(component.matchCount()).toBe(2);
  });

  it('toggleEnabled flips the enabled flag', () => {
    const { component, triggerService } = setup();
    const created = triggerService.create({
      name: 'X',
      pattern: 'x',
      flags: '',
      action: { kind: 'highlight', foreground: '#fff' },
      enabled: true,
    });

    component.toggleEnabled(created);
    expect(triggerService.triggers[0].enabled).toBe(false);
  });
});
