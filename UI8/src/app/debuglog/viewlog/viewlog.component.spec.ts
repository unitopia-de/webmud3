import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewlogComponent } from './viewlog.component';

describe('ViewlogComponent', () => {
  let component: ViewlogComponent;
  let fixture: ComponentFixture<ViewlogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ViewlogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ViewlogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
