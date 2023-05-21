import { TestBed } from '@angular/core/testing';

import { ReadLanguageService } from './read-language.service';

describe('ReadLanguageService', () => {
  let service: ReadLanguageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ReadLanguageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
