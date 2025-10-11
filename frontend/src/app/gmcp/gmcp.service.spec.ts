import { TestBed } from '@angular/core/testing';

import { GmcpService } from './gmcp.service';

describe('GmcpService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: GmcpService = TestBed.inject(GmcpService);
    expect(service).toBeTruthy();
  });
});
