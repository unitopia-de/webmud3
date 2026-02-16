import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { MudConfigService, MudConfigResponse } from './mud-config.service';
import { ServerConfigService } from '../serverconfig/server-config.service';

describe('MudConfigService', () => {
  let service: MudConfigService;
  let httpTesting: HttpTestingController;

  const multiMudResponse: MudConfigResponse = {
    available: true,
    muds: {
      unitopia: {
        name: 'UNItopia',
        description: 'Das deutschsprachige MUD',
        mudfamily: 'unitopia',
      },
      orbit: {
        name: 'Orbit',
        description: 'Test-MUD',
        mudfamily: 'unitopia',
      },
    },
    routes: {
      '/': 'unitopia',
      '/orbit': 'orbit',
    },
  };

  const singleMudResponse: MudConfigResponse = {
    available: false,
    muds: {},
    routes: {},
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ServerConfigService,
          useValue: { getBackendUrl: () => 'http://localhost:5000' },
        },
      ],
    });

    service = TestBed.inject(MudConfigService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('load() in multi-MUD mode', () => {
    it('should set isMultiMud to true', async () => {
      const loadPromise = service.load();
      const req = httpTesting.expectOne(
        'http://localhost:5000/api/mud-config',
      );
      req.flush(multiMudResponse);
      await loadPromise;

      expect(service.isMultiMud).toBe(true);
    });

    it('should populate muds map', async () => {
      const loadPromise = service.load();
      httpTesting
        .expectOne('http://localhost:5000/api/mud-config')
        .flush(multiMudResponse);
      await loadPromise;

      expect(Object.keys(service.muds)).toEqual(['unitopia', 'orbit']);
      expect(service.muds['unitopia'].name).toBe('UNItopia');
    });

    it('should resolve MUD ID for route', async () => {
      const loadPromise = service.load();
      httpTesting
        .expectOne('http://localhost:5000/api/mud-config')
        .flush(multiMudResponse);
      await loadPromise;

      expect(service.getMudIdForRoute('/')).toBe('unitopia');
      expect(service.getMudIdForRoute('/orbit')).toBe('orbit');
    });

    it('should return default MUD ID', async () => {
      const loadPromise = service.load();
      httpTesting
        .expectOne('http://localhost:5000/api/mud-config')
        .flush(multiMudResponse);
      await loadPromise;

      expect(service.getDefaultMudId()).toBe('unitopia');
    });

    it('should resolve direct MUD IDs', async () => {
      const loadPromise = service.load();
      httpTesting
        .expectOne('http://localhost:5000/api/mud-config')
        .flush(multiMudResponse);
      await loadPromise;

      expect(service.resolveMudId('unitopia')).toBe('unitopia');
      expect(service.resolveMudId('orbit')).toBe('orbit');
    });

    it('should resolve route-based IDs with and without leading slash', async () => {
      const loadPromise = service.load();
      httpTesting
        .expectOne('http://localhost:5000/api/mud-config')
        .flush(multiMudResponse);
      await loadPromise;

      expect(service.resolveMudId('orbit')).toBe('orbit');
    });
  });

  describe('load() in single-MUD mode', () => {
    it('should set isMultiMud to false', async () => {
      const loadPromise = service.load();
      httpTesting
        .expectOne('http://localhost:5000/api/mud-config')
        .flush(singleMudResponse);
      await loadPromise;

      expect(service.isMultiMud).toBe(false);
    });

    it('should return empty muds', async () => {
      const loadPromise = service.load();
      httpTesting
        .expectOne('http://localhost:5000/api/mud-config')
        .flush(singleMudResponse);
      await loadPromise;

      expect(Object.keys(service.muds)).toEqual([]);
    });

    it('should return undefined for default MUD ID', async () => {
      const loadPromise = service.load();
      httpTesting
        .expectOne('http://localhost:5000/api/mud-config')
        .flush(singleMudResponse);
      await loadPromise;

      expect(service.getDefaultMudId()).toBeUndefined();
    });
  });

  describe('load() with network error', () => {
    it('should fall back to single-MUD mode', async () => {
      const loadPromise = service.load();
      httpTesting
        .expectOne('http://localhost:5000/api/mud-config')
        .error(new ProgressEvent('error'));
      await loadPromise;

      expect(service.isMultiMud).toBe(false);
      expect(Object.keys(service.muds)).toEqual([]);
    });
  });
});
