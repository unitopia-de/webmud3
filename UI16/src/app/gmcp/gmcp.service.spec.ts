import { TestBed } from '@angular/core/testing';

import { GmcpService } from './gmcp.service';

describe('GmcpService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: GmcpService = TestBed.get(GmcpService);
    expect(service).toBeTruthy();
  });
});
