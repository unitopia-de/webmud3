import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { namespacedKey } from '@webmud3/frontend/shared/utils/storage-namespace';
import { ShellPreferenceService } from './shell-preference.service';

const KEY = namespacedKey('webmud3-last-shell');

describe('ShellPreferenceService', () => {
  let events: Subject<unknown>;
  let svc: ShellPreferenceService;
  let nextId = 1;

  function navigateTo(url: string): void {
    events.next(new NavigationEnd(nextId++, url, url));
  }

  beforeEach(() => {
    localStorage.clear();
    events = new Subject();
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { events } as unknown as Router },
      ],
    });
    svc = TestBed.inject(ShellPreferenceService);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('returns null when nothing is stored', () => {
    expect(svc.getRemembered()).toBeNull();
  });

  it('remembers the classic shell', () => {
    navigateTo('/');
    expect(svc.getRemembered()).toBe('/');
    expect(localStorage.getItem(KEY)).toBe('/');
  });

  it('remembers the ez shell', () => {
    navigateTo('/ez');
    expect(svc.getRemembered()).toBe('/ez');
  });

  it('ignores non-shell routes (e.g. /hilfe)', () => {
    navigateTo('/ez');
    navigateTo('/hilfe');
    // The non-shell route must not overwrite the remembered shell.
    expect(svc.getRemembered()).toBe('/ez');
  });

  it('strips query/fragment before matching', () => {
    navigateTo('/ez?perf=1');
    expect(svc.getRemembered()).toBe('/ez');
  });
});
