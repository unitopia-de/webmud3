import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MudmenuComponent } from './mudmenu.component';

describe('MudmenuComponent', () => {
  let component: MudmenuComponent;
  let fixture: ComponentFixture<MudmenuComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ MudmenuComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MudmenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
