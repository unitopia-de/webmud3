import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CharStatComponent } from './char-stat.component';

describe('CharStatComponent', () => {
  let component: CharStatComponent;
  let fixture: ComponentFixture<CharStatComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CharStatComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CharStatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
