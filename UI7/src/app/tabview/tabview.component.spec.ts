import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TabviewComponent } from './tabview.component';

describe('TabviewComponent', () => {
  let component: TabviewComponent;
  let fixture: ComponentFixture<TabviewComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ TabviewComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TabviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
