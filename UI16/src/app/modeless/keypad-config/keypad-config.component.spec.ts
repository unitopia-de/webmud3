import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KeypadConfigComponent } from './keypad-config.component';

describe('KeypadConfigComponent', () => {
  let component: KeypadConfigComponent;
  let fixture: ComponentFixture<KeypadConfigComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ KeypadConfigComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(KeypadConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
