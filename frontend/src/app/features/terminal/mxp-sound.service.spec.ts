import { TestBed } from '@angular/core/testing';

import { SoundService } from '@webmud3/frontend/features/sound/sound.service';
import { MxpSoundService } from './mxp-sound.service';

/**
 * Stand-in for SoundService that exposes only what MxpSoundService needs.
 * Saves us from instantiating the whole sockets / gmcp / server-config
 * chain that the real service pulls in.
 */
class SoundServiceStub {
  public gmcpActive = false;
  public enabled = true;
  public play = jest.fn();
}

describe('MxpSoundService', () => {
  let mxpSound: MxpSoundService;
  let stub: SoundServiceStub;

  beforeEach(() => {
    stub = new SoundServiceStub();
    TestBed.configureTestingModule({
      providers: [{ provide: SoundService, useValue: stub }],
    });
    mxpSound = TestBed.inject(MxpSoundService);
  });

  it('plays nothing when the file is empty', () => {
    mxpSound.playEvent('');
    expect(stub.play).not.toHaveBeenCalled();
  });

  it('plays the file using the cached base URL', () => {
    mxpSound.setBaseUrl('https://example.com/sounds');
    mxpSound.playEvent('combat/hit.mp3');
    expect(stub.play).toHaveBeenCalledWith(
      'https://example.com/sounds/combat/hit.mp3',
    );
  });

  it('handles a base URL with trailing slash and a file with leading slash', () => {
    mxpSound.setBaseUrl('https://example.com/sounds/');
    mxpSound.playEvent('/combat/hit.mp3');
    expect(stub.play).toHaveBeenCalledWith(
      'https://example.com/sounds/combat/hit.mp3',
    );
  });

  it('passes through absolute URLs unchanged', () => {
    mxpSound.setBaseUrl('https://example.com/sounds');
    mxpSound.playEvent('https://other.example.com/x.mp3');
    expect(stub.play).toHaveBeenCalledWith('https://other.example.com/x.mp3');
  });

  it('plays without base URL — file name is used as-is', () => {
    mxpSound.playEvent('local.mp3');
    expect(stub.play).toHaveBeenCalledWith('local.mp3');
  });

  it('skips playback while GMCP-sound is active', () => {
    stub.gmcpActive = true;
    mxpSound.setBaseUrl('https://example.com/sounds');
    mxpSound.playEvent('hit.mp3');
    expect(stub.play).not.toHaveBeenCalled();
  });

  it('clear() drops the base URL', () => {
    mxpSound.setBaseUrl('https://example.com/sounds');
    mxpSound.clear();
    mxpSound.playEvent('hit.mp3');
    expect(stub.play).toHaveBeenCalledWith('hit.mp3');
  });
});
