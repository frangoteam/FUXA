/* tslint:disable:no-unused-variable */
import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { ScriptModeComponent } from './script-mode.component';

describe('ScriptModeComponent', () => {
  let component: ScriptModeComponent;
  let fixture: ComponentFixture<ScriptModeComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ScriptModeComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ScriptModeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
