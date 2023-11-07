import { TestBed } from '@angular/core/testing';

import { MudConfigService } from './mud-config.service';

describe('MudConfigService', () => {
  let service: MudConfigService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MudConfigService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
