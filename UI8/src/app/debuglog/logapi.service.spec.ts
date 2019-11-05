import { TestBed } from '@angular/core/testing';

import { LogapiService } from './logapi.service';

describe('LogapiService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: LogapiService = TestBed.get(LogapiService);
    expect(service).toBeTruthy();
  });
});
