import { TestBed } from '@angular/core/testing';

import { WindowsService } from './windows.service';

describe('WindowsService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: WindowsService = TestBed.get(WindowsService);
    expect(service).toBeTruthy();
  });
});
