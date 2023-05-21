import { TestBed, inject } from '@angular/core/testing';

import { AnsiService } from './ansi.service';

describe('AnsiService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AnsiService]
    });
  });

  it('should be created', inject([AnsiService], (service: AnsiService) => {
    expect(service).toBeTruthy();
  }));
});
