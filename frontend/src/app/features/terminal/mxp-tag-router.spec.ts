import { TestBed } from '@angular/core/testing';

import { MxpEntityService } from './mxp-entity.service';
import { MxpSoundService } from './mxp-sound.service';
import { MxpStatService } from './mxp-stat.service';
import { MxpTagRouter } from './mxp-tag-router';

class MxpSoundServiceStub {
  public setBaseUrl = jest.fn();
  public playEvent = jest.fn();
  public clear = jest.fn();
}

describe('MxpTagRouter', () => {
  let router: MxpTagRouter;
  let entities: MxpEntityService;
  let stats: MxpStatService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: MxpSoundService, useClass: MxpSoundServiceStub },
      ],
    });
    router = TestBed.inject(MxpTagRouter);
    entities = TestBed.inject(MxpEntityService);
    stats = TestBed.inject(MxpStatService);
  });

  describe('!ENTITY routing', () => {
    it('stores name -> value', () => {
      router.handle('<!ENTITY ap "100" DESC="Ausdauerpunkte" PUBLISH>');
      expect(entities.get('ap')).toBe('100');
    });

    it('updates the value when the same entity is sent again', () => {
      router.handle('<!ENTITY ap "100" PUBLISH>');
      router.handle('<!ENTITY ap "85" PUBLISH>');
      expect(entities.get('ap')).toBe('85');
    });

    it('handles entity values without quotes', () => {
      router.handle('<!ENTITY foo bar PUBLISH>');
      expect(entities.get('foo')).toBe('bar');
    });

    it('ignores closing tags', () => {
      router.handle('</rshort>');
      // Should not throw or pollute the maps.
      expect(stats.stats.length).toBe(0);
    });
  });

  describe('<stat> routing', () => {
    it('registers a stat with name + max + caption', () => {
      router.handle('<stat ap max=maxap caption="AP:">');
      expect(stats.stats).toEqual([
        { name: 'ap', maxName: 'maxap', caption: 'AP:' },
      ]);
    });

    it('replaces an existing stat with new caption', () => {
      router.handle('<stat ap max=maxap caption="AP:">');
      router.handle('<stat ap max=maxap caption="Energie:">');
      expect(stats.stats).toEqual([
        { name: 'ap', maxName: 'maxap', caption: 'Energie:' },
      ]);
    });

    it('keeps multiple distinct stats', () => {
      router.handle('<stat ap max=maxap caption="AP:">');
      router.handle('<stat zp max=maxzp caption="LP:">');
      expect(stats.stats.map((s) => s.name)).toEqual(['ap', 'zp']);
    });

    it('handles a stat without max or caption', () => {
      router.handle('<stat ap>');
      expect(stats.stats).toEqual([
        { name: 'ap', maxName: undefined, caption: undefined },
      ]);
    });
  });

  describe('<sound> routing', () => {
    it('routes a base-URL announcement to MxpSoundService.setBaseUrl', () => {
      const sounds = TestBed.inject(MxpSoundService);
      const setBaseUrl = jest.spyOn(sounds, 'setBaseUrl');
      router.handle('<sound Off U="https://example.com/sounds">');
      expect(setBaseUrl).toHaveBeenCalledWith('https://example.com/sounds');
    });

    it('routes an inline event to MxpSoundService.playEvent', () => {
      const sounds = TestBed.inject(MxpSoundService);
      const playEvent = jest.spyOn(sounds, 'playEvent');
      router.handle('<sound "kampf/treffer.mp3">');
      expect(playEvent).toHaveBeenCalledWith('kampf/treffer.mp3');
    });

    it('does not call playEvent when only U= is present', () => {
      const sounds = TestBed.inject(MxpSoundService);
      const playEvent = jest.spyOn(sounds, 'playEvent');
      router.handle('<sound Off U="https://example.com/sounds">');
      expect(playEvent).not.toHaveBeenCalled();
    });
  });

  describe('clearing', () => {
    it('clear() empties both stores', () => {
      router.handle('<!ENTITY ap "10" PUBLISH>');
      router.handle('<stat ap max=maxap caption="AP:">');
      entities.clear();
      stats.clear();
      expect(entities.get('ap')).toBeUndefined();
      expect(stats.stats.length).toBe(0);
    });
  });
});
