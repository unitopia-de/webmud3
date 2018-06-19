import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MudclientComponent } from './mudclient.component';

describe('MudclientComponent', () => {
  let component: MudclientComponent;
  let fixture: ComponentFixture<MudclientComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ MudclientComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MudclientComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
