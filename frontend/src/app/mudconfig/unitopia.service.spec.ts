import { TestBed } from '@angular/core/testing';

import { UnitopiaService } from './unitopia.service';

describe('UnitopiaService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: UnitopiaService = TestBed.inject(UnitopiaService);
    expect(service).toBeTruthy();
  });
});
