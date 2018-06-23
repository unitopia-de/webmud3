import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MudspanComponent } from './mudspan.component';

describe('MudspanComponent', () => {
  let component: MudspanComponent;
  let fixture: ComponentFixture<MudspanComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ MudspanComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MudspanComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
