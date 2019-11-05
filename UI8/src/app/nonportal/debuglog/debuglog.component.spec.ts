import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DebuglogComponent } from './debuglog.component';

describe('DebuglogComponent', () => {
  let component: DebuglogComponent;
  let fixture: ComponentFixture<DebuglogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ DebuglogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DebuglogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
