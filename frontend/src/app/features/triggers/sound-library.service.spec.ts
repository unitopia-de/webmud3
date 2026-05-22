import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { namespacedKey } from '@webmud3/frontend/shared/utils/storage-namespace';

import { builtinSoundId, personalSoundId } from './models/sound';
import {
  MAX_PERSONAL_SOUND_BYTES,
  MAX_PERSONAL_TOTAL_BYTES,
  SoundLibraryService,
} from './sound-library.service';

const PERSONAL_STORAGE_SUFFIX = 'wm3cc.sounds.personal.v1';

function makeManifest() {
  return {
    version: 1,
    sounds: [
      { id: 'alert', label: 'Alert', file: 'alert.wav' },
      { id: 'bell', label: 'Bell', file: 'bell.wav' },
    ],
  };
}

/**
 * Builds a fake `File` whose resulting data URL is approximately `bytes`
 * characters long. Base64 inflates raw bytes by ~4/3, so we invert that to
 * pick the underlying blob size.
 */
function makeAudioFile(bytes: number, mime = 'audio/wav', name = 'sample.wav'): File {
  const headerLen = `data:${mime};base64,`.length;
  // Subtract a small safety margin so base64 padding never pushes us above
  // the requested size.
  const target = Math.max(0, bytes - headerLen - 4);
  const rawBytes = Math.floor((target * 3) / 4);
  const blob = new Blob([new Uint8Array(rawBytes)], { type: mime });
  return new File([blob], name, { type: mime });
}

describe('SoundLibraryService', () => {
  let service: SoundLibraryService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SoundLibraryService,
      ],
    });
    service = TestBed.inject(SoundLibraryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('loads the built-in manifest on construction', async () => {
    const req = httpMock.expectOne('assets/sounds/manifest.json');
    req.flush(makeManifest());
    await service.whenReady();

    expect(service.builtin.map((s) => s.id)).toEqual(['alert', 'bell']);
    expect(service.builtin[0].url).toBe('assets/sounds/alert.wav');
  });

  it('survives a missing manifest with an empty list', async () => {
    const req = httpMock.expectOne('assets/sounds/manifest.json');
    req.flush('not found', { status: 404, statusText: 'Not Found' });
    await service.whenReady();

    expect(service.builtin).toEqual([]);
  });

  it('resolves built-in and personal sounds by namespaced id', async () => {
    const req = httpMock.expectOne('assets/sounds/manifest.json');
    req.flush(makeManifest());
    await service.whenReady();

    const builtin = service.resolve(builtinSoundId('alert'));
    expect(builtin?.kind).toBe('builtin');
    expect(service.resolveUrl(builtinSoundId('alert'))).toBe(
      'assets/sounds/alert.wav',
    );

    expect(service.resolve(builtinSoundId('missing'))).toBeNull();
    expect(service.resolve(personalSoundId('missing'))).toBeNull();
    expect(service.resolve('plain-no-prefix')).toBeNull();
  });

  it('imports a personal sound and persists it', async () => {
    httpMock.expectOne('assets/sounds/manifest.json').flush({ version: 1, sounds: [] });

    const file = makeAudioFile(1024, 'audio/wav', 'mybeep.wav');
    const sound = await service.importPersonal(file);

    expect(sound.kind).toBe('personal');
    expect(sound.label).toBe('mybeep');
    expect(sound.mimeType).toBe('audio/wav');
    expect(sound.sizeBytes).toBeGreaterThan(0);
    expect(service.personal).toHaveLength(1);

    const stored = JSON.parse(
      localStorage.getItem(namespacedKey(PERSONAL_STORAGE_SUFFIX)) as string,
    );
    expect(stored).toHaveLength(1);
    expect(stored[0].label).toBe('mybeep');
  });

  it('uses a custom label when provided', async () => {
    httpMock.expectOne('assets/sounds/manifest.json').flush({ version: 1, sounds: [] });

    const sound = await service.importPersonal(
      makeAudioFile(512, 'audio/ogg', 'whatever.ogg'),
      'My Sound',
    );
    expect(sound.label).toBe('My Sound');
  });

  it('rejects an unsupported MIME type', async () => {
    httpMock.expectOne('assets/sounds/manifest.json').flush({ version: 1, sounds: [] });

    const file = new File(['x'], 'evil.exe', { type: 'application/octet-stream' });
    await expect(service.importPersonal(file)).rejects.toThrow(/Unsupported MIME type/);
    expect(service.personal).toEqual([]);
  });

  it('rejects a file that exceeds the per-sound limit', async () => {
    httpMock.expectOne('assets/sounds/manifest.json').flush({ version: 1, sounds: [] });

    const tooBig = makeAudioFile(MAX_PERSONAL_SOUND_BYTES + 1024);
    await expect(service.importPersonal(tooBig)).rejects.toThrow(/Sound too large/);
    expect(service.personal).toEqual([]);
  });

  it('rejects an import that would exceed the total quota', async () => {
    httpMock.expectOne('assets/sounds/manifest.json').flush({ version: 1, sounds: [] });

    // Fill close to the cap with multiple imports.
    const chunk = makeAudioFile(MAX_PERSONAL_SOUND_BYTES);
    const numChunks = Math.floor(MAX_PERSONAL_TOTAL_BYTES / MAX_PERSONAL_SOUND_BYTES);

    for (let i = 0; i < numChunks; i++) {
      await service.importPersonal(chunk, `s${i}`);
    }

    await expect(
      service.importPersonal(makeAudioFile(MAX_PERSONAL_SOUND_BYTES)),
    ).rejects.toThrow(/quota exceeded/);
  });

  it('renames and deletes personal sounds', async () => {
    httpMock.expectOne('assets/sounds/manifest.json').flush({ version: 1, sounds: [] });

    const created = await service.importPersonal(makeAudioFile(256));
    service.renamePersonal(created.id, '  Renamed  ');
    expect(service.personal[0].label).toBe('Renamed');

    expect(() => service.renamePersonal(created.id, '   ')).toThrow(/empty/);
    expect(() => service.renamePersonal('nope', 'x')).toThrow(/unknown id/);

    expect(service.deletePersonal(created.id)).toBe(true);
    expect(service.personal).toEqual([]);
    expect(service.deletePersonal(created.id)).toBe(false);
  });

  it('reloads personal sounds from storage on construction', async () => {
    httpMock.expectOne('assets/sounds/manifest.json').flush({ version: 1, sounds: [] });

    await service.importPersonal(makeAudioFile(256, 'audio/wav', 'one.wav'));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SoundLibraryService,
      ],
    });
    const second = TestBed.inject(SoundLibraryService);
    const secondHttp = TestBed.inject(HttpTestingController);
    secondHttp.expectOne('assets/sounds/manifest.json').flush({ version: 1, sounds: [] });
    await second.whenReady();

    expect(second.personal).toHaveLength(1);
    expect(second.personal[0].label).toBe('one');
    secondHttp.verify();
  });
});
