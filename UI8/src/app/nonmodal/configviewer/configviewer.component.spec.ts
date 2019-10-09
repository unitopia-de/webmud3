import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfigviewerComponent } from './configviewer.component';

describe('ConfigviewerComponent', () => {
  let component: ConfigviewerComponent;
  let fixture: ComponentFixture<ConfigviewerComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ConfigviewerComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ConfigviewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
