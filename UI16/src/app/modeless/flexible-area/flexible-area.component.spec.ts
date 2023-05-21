import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FlexibleAreaComponent } from './flexible-area.component';

describe('FlexibleAreaComponent', () => {
  let component: FlexibleAreaComponent;
  let fixture: ComponentFixture<FlexibleAreaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ FlexibleAreaComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(FlexibleAreaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
