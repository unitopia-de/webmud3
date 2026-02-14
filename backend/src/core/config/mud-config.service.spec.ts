import fs from 'fs';
import path from 'path';
import os from 'os';

import type { MudConfigFile } from '@webmud3/shared';

// We need to reset the singleton between tests, so we use a helper
// that clears the private static `instance` field.
function resetSingleton() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (MudConfigService as any).instance = undefined;
}

// Import after mocks are set up
import { MudConfigService } from './mud-config.service.js';

const sampleConfig: MudConfigFile = {
  scope: 'test',
  href: '/',
  mudfamilies: {
    unitopia: {
      charset: 'utf8',
      MXP: true,
      GMCP: true,
      GMCP_Support: {
        Sound: { version: '1', standard: true, optional: false },
        Char: { version: '1', standard: true, optional: false },
      },
    },
    basistelnet: {
      charset: 'ascii',
      MXP: false,
      GMCP: false,
      GMCP_Support: {},
    },
  },
  muds: {
    unitopia: {
      name: 'UNItopia',
      host: 'unitopia.de',
      port: 992,
      ssl: true,
      rejectUnauthorized: true,
      description: 'UNItopia via SSL',
      playerlevel: 'all',
      mudfamily: 'unitopia',
    },
    seifenblase: {
      name: 'Seifenblase',
      host: 'seifenblase.de',
      port: 3333,
      ssl: false,
      rejectUnauthorized: false,
      description: 'Seifenblase',
      playerlevel: 'all',
      mudfamily: 'basistelnet',
    },
  },
  routes: {
    '/': 'unitopia',
    '/seifenblase': 'seifenblase',
  },
};

describe('MudConfigService', () => {
  let tmpFile: string;

  beforeEach(() => {
    resetSingleton();
  });

  afterEach(() => {
    resetSingleton();

    // Clean up temp file if it was created
    if (tmpFile && fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }
  });

  function createTempConfig(content: MudConfigFile): string {
    tmpFile = path.join(os.tmpdir(), `mud-config-test-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify(content), 'utf-8');

    return tmpFile;
  }

  describe('when MUD_CONFIG_PATH is not set', () => {
    it('should report isAvailable = false', () => {
      const service = MudConfigService.getInstance(null);

      expect(service.isAvailable).toBe(false);
    });

    it('should return empty MUD list', () => {
      const service = MudConfigService.getInstance(null);

      expect(service.getMudList()).toEqual({});
    });

    it('should return empty routes', () => {
      const service = MudConfigService.getInstance(null);

      expect(service.getRoutes()).toEqual({});
    });

    it('should return undefined for getMudById', () => {
      const service = MudConfigService.getInstance(null);

      expect(service.getMudById('unitopia')).toBeUndefined();
    });

    it('should return undefined for resolveConnection', () => {
      const service = MudConfigService.getInstance(null);

      expect(service.resolveConnection('unitopia')).toBeUndefined();
    });
  });

  describe('when MUD_CONFIG_PATH is set but file does not exist', () => {
    it('should report isAvailable = false', () => {
      const service = MudConfigService.getInstance('/nonexistent/path.json');

      expect(service.isAvailable).toBe(false);
    });

    it('should return empty MUD list', () => {
      const service = MudConfigService.getInstance('/nonexistent/path.json');

      expect(service.getMudList()).toEqual({});
    });
  });

  describe('when config file is loaded successfully', () => {
    it('should report isAvailable = true', () => {
      const configPath = createTempConfig(sampleConfig);
      const service = MudConfigService.getInstance(configPath);

      expect(service.isAvailable).toBe(true);
    });

    it('should return MUD by ID', () => {
      const configPath = createTempConfig(sampleConfig);
      const service = MudConfigService.getInstance(configPath);

      const mud = service.getMudById('unitopia');

      expect(mud).toBeDefined();
      expect(mud!.name).toBe('UNItopia');
      expect(mud!.host).toBe('unitopia.de');
      expect(mud!.port).toBe(992);
    });

    it('should return undefined for unknown MUD ID', () => {
      const configPath = createTempConfig(sampleConfig);
      const service = MudConfigService.getInstance(configPath);

      expect(service.getMudById('unknown')).toBeUndefined();
    });

    it('should resolve connection for known MUD', () => {
      const configPath = createTempConfig(sampleConfig);
      const service = MudConfigService.getInstance(configPath);

      const conn = service.resolveConnection('unitopia');

      expect(conn).toEqual({
        host: 'unitopia.de',
        port: 992,
        ssl: true,
        mudfamily: 'unitopia',
        name: 'UNItopia',
      });
    });

    it('should return GMCP support for GMCP-enabled family', () => {
      const configPath = createTempConfig(sampleConfig);
      const service = MudConfigService.getInstance(configPath);

      const support = service.getGmcpSupport('unitopia');

      expect(support).toBeDefined();
      expect(support!['Sound']).toEqual({
        version: '1',
        standard: true,
        optional: false,
      });
    });

    it('should return undefined GMCP support for non-GMCP family', () => {
      const configPath = createTempConfig(sampleConfig);
      const service = MudConfigService.getInstance(configPath);

      const support = service.getGmcpSupport('seifenblase');

      expect(support).toBeUndefined();
    });

    it('should return MUD list for frontend', () => {
      const configPath = createTempConfig(sampleConfig);
      const service = MudConfigService.getInstance(configPath);

      const list = service.getMudList();

      expect(Object.keys(list)).toHaveLength(2);
      expect(list['unitopia']).toEqual({
        name: 'UNItopia',
        description: 'UNItopia via SSL',
        mudfamily: 'unitopia',
      });
    });

    it('should return routes', () => {
      const configPath = createTempConfig(sampleConfig);
      const service = MudConfigService.getInstance(configPath);

      expect(service.getRoutes()).toEqual({
        '/': 'unitopia',
        '/seifenblase': 'seifenblase',
      });
    });

    it('should return MUD family config', () => {
      const configPath = createTempConfig(sampleConfig);
      const service = MudConfigService.getInstance(configPath);

      const family = service.getMudFamily('unitopia');

      expect(family).toBeDefined();
      expect(family!.GMCP).toBe(true);
      expect(family!.charset).toBe('utf8');
    });
  });

  describe('when config file contains invalid JSON', () => {
    it('should report isAvailable = false', () => {
      tmpFile = path.join(
        os.tmpdir(),
        `mud-config-invalid-${Date.now()}.json`,
      );
      fs.writeFileSync(tmpFile, '{invalid json}', 'utf-8');

      const service = MudConfigService.getInstance(tmpFile);

      expect(service.isAvailable).toBe(false);
    });
  });
});
