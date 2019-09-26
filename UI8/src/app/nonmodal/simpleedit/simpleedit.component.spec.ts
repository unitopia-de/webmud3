import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SimpleeditComponent } from './simpleedit.component';

describe('SimpleeditComponent', () => {
  let component: SimpleeditComponent;
  let fixture: ComponentFixture<SimpleeditComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SimpleeditComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SimpleeditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
