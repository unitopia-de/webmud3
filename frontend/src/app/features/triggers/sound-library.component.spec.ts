import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { SoundLibraryComponent } from './sound-library.component';
import { SoundLibraryService } from './sound-library.service';

function setup() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
    imports: [SoundLibraryComponent],
  });
  const fixture = TestBed.createComponent(SoundLibraryComponent);
  const http = TestBed.inject(HttpTestingController);
  const reqs = http.match('assets/sounds/manifest.json');
  for (const req of reqs) {
    req.flush({
      version: 1,
      sounds: [
        { id: 'alert', label: 'Alert', file: 'alert.wav' },
        { id: 'bell', label: 'Bell', file: 'bell.wav' },
      ],
    });
  }
  return {
    fixture,
    component: fixture.componentInstance,
    library: TestBed.inject(SoundLibraryService),
    http,
  };
}

describe('SoundLibraryComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('starts on the builtin tab and lists manifest sounds', async () => {
    const { component, library, http } = setup();
    await library.whenReady();

    expect(component.tab()).toBe('builtin');
    expect(component.builtinSounds().map((s) => s.id)).toEqual(['alert', 'bell']);
    http.verify();
  });

  it('switches tabs and clears any pending import error', () => {
    const { component } = setup();

    component.importError.set('boom');
    component.selectTab('personal');

    expect(component.tab()).toBe('personal');
    expect(component.importError()).toBe('');
  });

  it('reports the personal byte total via the helper', async () => {
    const { component, library, http } = setup();
    await library.whenReady();

    expect(component.personalBytes()).toBe(0);

    // Inject a personal sound directly into the service so we don't have to
    // marshal a File through jsdom.
    await library.importPersonal(
      new File([new Uint8Array(256)], 'beep.wav', { type: 'audio/wav' }),
    );

    expect(component.personalBytes()).toBeGreaterThan(0);
    http.verify();
  });

  it('formats bytes for the footer label', () => {
    const { component, http } = setup();
    expect(component.formatBytes(500)).toBe('500 B');
    expect(component.formatBytes(2048)).toBe('2.0 KB');
    expect(component.formatBytes(2 * 1024 * 1024)).toBe('2.00 MB');
    http.verify();
  });

  it('surfaces import errors from the service in importError()', async () => {
    const { component, http } = setup();

    const bogus = new File(['x'], 'notes.txt', { type: 'text/plain' });
    Object.defineProperty(
      { target: { files: [bogus], value: '' } },
      'target',
      {},
    );

    const fakeEvent = {
      target: { files: [bogus], value: '' },
    } as unknown as Event;

    await component.onFileChosen(fakeEvent);

    expect(component.importError()).toMatch(/Unsupported MIME type/);
    http.verify();
  });
});
