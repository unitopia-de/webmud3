import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MudlistComponent } from './mudlist.component';

describe('MudlistComponent', () => {
  let component: MudlistComponent;
  let fixture: ComponentFixture<MudlistComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ MudlistComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MudlistComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
