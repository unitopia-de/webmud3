import { TestBed } from '@angular/core/testing';

import { SoundLibraryService } from './sound-library.service';
import { SoundPlayerService } from './sound-player.service';
import { TriggerService } from './trigger.service';

class TriggerServiceStub {
  public settings = { globallyEnabled: true, masterVolume: 1 };
}

class SoundLibraryStub {
  public resolveUrl = jest.fn<string | null, [string]>();
}

interface FakeAudio {
  src: string;
  volume: number;
  currentTime: number;
  paused: boolean;
  preload: string;
  play: jest.Mock<Promise<void>, []>;
  pause: jest.Mock<void, []>;
}

const createdAudios: FakeAudio[] = [];

class AudioMock implements FakeAudio {
  public src: string;
  public volume = 1;
  public currentTime = 0;
  public paused = true;
  public preload = '';
  public play = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
  public pause = jest.fn<void, []>(() => {
    this.paused = true;
  });

  constructor(url: string) {
    this.src = url;
    createdAudios.push(this);
  }
}

describe('SoundPlayerService', () => {
  let player: SoundPlayerService;
  let library: SoundLibraryStub;
  let triggers: TriggerServiceStub;
  let originalAudio: typeof Audio;

  beforeEach(() => {
    originalAudio = globalThis.Audio;
    // Cast through unknown — AudioMock implements the small surface play() needs.
    globalThis.Audio = AudioMock as unknown as typeof Audio;
    createdAudios.length = 0;

    library = new SoundLibraryStub();
    triggers = new TriggerServiceStub();

    TestBed.configureTestingModule({
      providers: [
        SoundPlayerService,
        { provide: SoundLibraryService, useValue: library },
        { provide: TriggerService, useValue: triggers },
      ],
    });
    player = TestBed.inject(SoundPlayerService);
  });

  afterEach(() => {
    globalThis.Audio = originalAudio;
    jest.useRealTimers();
  });

  it('plays a known sound and sets the effective volume', () => {
    library.resolveUrl.mockReturnValue('assets/sounds/alert.wav');
    triggers.settings = { globallyEnabled: true, masterVolume: 0.5 };

    const ok = player.play('builtin:alert', 0.4);

    expect(ok).toBe(true);
    expect(createdAudios).toHaveLength(1);
    expect(createdAudios[0].src).toBe('assets/sounds/alert.wav');
    expect(createdAudios[0].volume).toBeCloseTo(0.2, 5);
    expect(createdAudios[0].play).toHaveBeenCalled();
  });

  it('is a no-op when triggers are globally disabled', () => {
    library.resolveUrl.mockReturnValue('assets/sounds/alert.wav');
    triggers.settings = { globallyEnabled: false, masterVolume: 1 };

    expect(player.play('builtin:alert')).toBe(false);
    expect(createdAudios).toHaveLength(0);
  });

  it('is a no-op when the effective volume is zero', () => {
    library.resolveUrl.mockReturnValue('assets/sounds/alert.wav');
    triggers.settings = { globallyEnabled: true, masterVolume: 0 };

    expect(player.play('builtin:alert', 1)).toBe(false);
    expect(createdAudios).toHaveLength(0);
  });

  it('returns false and warns when the sound id is unknown', () => {
    library.resolveUrl.mockReturnValue(null);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(player.play('personal:gone')).toBe(false);
    expect(warn).toHaveBeenCalledWith('[SoundPlayer] Unknown sound id: personal:gone');
  });

  it('debounces consecutive plays of the same id within 250 ms', () => {
    library.resolveUrl.mockReturnValue('assets/sounds/alert.wav');
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-22T12:00:00Z'));

    expect(player.play('builtin:alert')).toBe(true);
    jest.setSystemTime(new Date('2026-05-22T12:00:00.100Z'));
    expect(player.play('builtin:alert')).toBe(false);
    jest.setSystemTime(new Date('2026-05-22T12:00:00.260Z'));
    expect(player.play('builtin:alert')).toBe(true);
  });

  it('plays different sound ids independently of each other', () => {
    library.resolveUrl.mockImplementation(
      (id) => id === 'builtin:a' ? 'a.wav' : 'b.wav',
    );

    expect(player.play('builtin:a')).toBe(true);
    expect(player.play('builtin:b')).toBe(true);
    expect(createdAudios).toHaveLength(2);
  });

  it('reuses the same Audio instance for repeated plays of the same url', () => {
    library.resolveUrl.mockReturnValue('reuse.wav');

    expect(player.play('builtin:r')).toBe(true);

    jest.useFakeTimers();
    jest.setSystemTime(new Date(Date.now() + 500));

    expect(player.play('builtin:r')).toBe(true);
    expect(createdAudios).toHaveLength(1);
    expect(createdAudios[0].play).toHaveBeenCalledTimes(2);
  });

  it('clamps masterVolume above 1 (defense in depth)', () => {
    library.resolveUrl.mockReturnValue('x.wav');
    triggers.settings = { globallyEnabled: true, masterVolume: 5 };

    player.play('builtin:x', 1);
    expect(createdAudios[0].volume).toBe(1);
  });

  it('stopAll pauses any currently playing audio', () => {
    library.resolveUrl.mockReturnValue('s.wav');
    player.play('builtin:s');
    createdAudios[0].paused = false;

    player.stopAll();
    expect(createdAudios[0].pause).toHaveBeenCalled();
  });
});
