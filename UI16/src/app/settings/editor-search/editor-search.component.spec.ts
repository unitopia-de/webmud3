import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditorSearchComponent } from './editor-search.component';

describe('EditorSearchComponent', () => {
  let component: EditorSearchComponent;
  let fixture: ComponentFixture<EditorSearchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EditorSearchComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(EditorSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
