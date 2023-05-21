import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DualComponent } from './dual.component';

describe('DualComponent', () => {
  let component: DualComponent;
  let fixture: ComponentFixture<DualComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DualComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DualComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
