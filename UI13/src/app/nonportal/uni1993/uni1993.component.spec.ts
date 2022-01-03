import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { Uni1993Component } from './uni1993.component';

describe('Uni1993Component', () => {
  let component: Uni1993Component;
  let fixture: ComponentFixture<Uni1993Component>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ Uni1993Component ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(Uni1993Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
