import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ScriptEditorComponent } from './script-editor.component';

describe('ScriptEditorComponent', () => {
  let component: ScriptEditorComponent;
  let fixture: ComponentFixture<ScriptEditorComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ScriptEditorComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ScriptEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
