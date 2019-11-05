import { TestBed, async, inject } from '@angular/core/testing';

import { DebuglogGuard } from './debuglog.guard';

describe('DebuglogGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DebuglogGuard]
    });
  });

  it('should ...', inject([DebuglogGuard], (guard: DebuglogGuard) => {
    expect(guard).toBeTruthy();
  }));
});
