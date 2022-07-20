import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KeyoneComponent } from './keyone.component';

describe('KeyoneComponent', () => {
  let component: KeyoneComponent;
  let fixture: ComponentFixture<KeyoneComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ KeyoneComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(KeyoneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
