import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DirlistComponent } from './dirlist.component';

describe('DirlistComponent', () => {
  let component: DirlistComponent;
  let fixture: ComponentFixture<DirlistComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ DirlistComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DirlistComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
