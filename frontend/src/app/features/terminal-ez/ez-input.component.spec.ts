import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';

import { MudService } from '@webmud3/frontend/core/mud/services/mud.service';
import { NumpadService } from '@webmud3/frontend/features/numpad/numpad.service';
import { EzInputComponent } from './ez-input.component';
import { QuietOutputService } from './quiet-output.service';
import { StickyInputService } from './sticky-input.service';

/** Minimal MudService stub: the component only reads these two streams. */
function mudStub() {
  return {
    linemode$: new BehaviorSubject<{ edit: boolean }>({ edit: true }),
    showEcho$: new BehaviorSubject<boolean>(true),
  };
}

/** Numpad never claims the key in these tests. */
const numpadStub = { triggerFromEvent: () => null };

function setup() {
  const mud = mudStub();
  TestBed.configureTestingModule({
    imports: [EzInputComponent],
    providers: [
      { provide: MudService, useValue: mud as unknown as MudService },
      { provide: NumpadService, useValue: numpadStub as unknown as NumpadService },
    ],
  });
  const fixture = TestBed.createComponent(EzInputComponent);
  // Attach so ViewChild fields and (optionally) focus behave realistically.
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  const cmp = fixture.componentInstance as unknown as Record<string, any>;
  return { fixture, cmp, mud };
}

function field(cmp: Record<string, any>): HTMLTextAreaElement {
  return cmp['defaultField'].nativeElement as HTMLTextAreaElement;
}

function submit(cmp: Record<string, any>, value: string): void {
  field(cmp).value = value;
  cmp['onDefaultSubmit'](new Event('submit'));
}

describe('EzInputComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    document.querySelectorAll('app-ez-input').forEach((n) => n.remove());
    TestBed.resetTestingModule();
  });

  describe('mode', () => {
    it('is "default" when edit + echo are on', () => {
      const { cmp } = setup();
      expect(cmp['mode']()).toBe('default');
    });

    it('becomes "password" when echo is turned off', () => {
      const { cmp, mud } = setup();
      mud.showEcho$.next(false);
      expect(cmp['mode']()).toBe('password');
    });

    it('becomes "editor" when edit mode is turned off', () => {
      const { cmp, mud } = setup();
      mud.linemode$.next({ edit: false });
      expect(cmp['mode']()).toBe('editor');
    });
  });

  describe('history navigation', () => {
    it('walks back to the most recent command, then older ones, then forward', () => {
      const { cmp } = setup();
      submit(cmp, 'look');
      submit(cmp, 'nord');
      expect(field(cmp).value).toBe(''); // cleared after submit (sticky off)

      cmp['onHistoryBack']();
      expect(field(cmp).value).toBe('nord');

      cmp['onHistoryBack']();
      expect(field(cmp).value).toBe('look');

      cmp['onHistoryForward']();
      expect(field(cmp).value).toBe('nord');
    });

    it('does not push duplicate consecutive commands', () => {
      const { cmp } = setup();
      submit(cmp, 'look');
      submit(cmp, 'look');
      cmp['onHistoryBack']();
      expect(field(cmp).value).toBe('look');
      // Only one entry → a second back finds nothing new and stays put.
      cmp['onHistoryBack']();
      expect(field(cmp).value).toBe('look');
    });
  });

  describe('quiet-mode recall (VoiceOver)', () => {
    it('announces the recalled command instead of leaving the announcer empty', async () => {
      const { cmp } = setup();
      TestBed.inject(QuietOutputService).setEnabled(true);
      submit(cmp, 'nord');

      cmp['onHistoryBack']();
      expect(field(cmp).value).toBe('nord');

      await Promise.resolve(); // flush the queued-microtask announcement
      const announcer = cmp['modeAnnouncer'].nativeElement as HTMLElement;
      expect(announcer.textContent).toBe('nord');
    });

    it('does NOT announce the recall in the default (non-quiet) mode', async () => {
      const { cmp } = setup();
      // quiet stays off
      submit(cmp, 'nord');

      cmp['onHistoryBack']();
      expect(field(cmp).value).toBe('nord');

      await Promise.resolve();
      const announcer = cmp['modeAnnouncer'].nativeElement as HTMLElement;
      expect(announcer.textContent).toBe('');
    });
  });

  describe('sticky input', () => {
    it('keeps the just-sent command in the line when sticky is on', () => {
      const { cmp } = setup();
      TestBed.inject(StickyInputService).setEnabled(true);
      submit(cmp, 'nord');
      expect(field(cmp).value).toBe('nord');
    });
  });
});
