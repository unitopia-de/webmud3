import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ColorSettingsComponent } from './color-settings.component';

describe('ColorSettingsComponent', () => {
  let component: ColorSettingsComponent;
  let fixture: ComponentFixture<ColorSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ColorSettingsComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ColorSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
