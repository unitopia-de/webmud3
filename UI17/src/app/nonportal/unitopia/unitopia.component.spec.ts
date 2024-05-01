import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { UnitopiaComponent } from './unitopia.component';

describe('UnitopiaComponent', () => {
  let component: UnitopiaComponent;
  let fixture: ComponentFixture<UnitopiaComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [UnitopiaComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(UnitopiaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
