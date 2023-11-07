import { TestBed } from '@angular/core/testing';

import { ServerConfigService } from './server-config.service';

describe('ServerConfigService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: ServerConfigService = TestBed.get(ServerConfigService);
    expect(service).toBeTruthy();
  });
});
