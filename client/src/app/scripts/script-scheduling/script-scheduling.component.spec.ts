import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ScriptSchedulingComponent } from './script-scheduling.component';

describe('ScriptSchedulingComponent', () => {
  let component: ScriptSchedulingComponent;
  let fixture: ComponentFixture<ScriptSchedulingComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ScriptSchedulingComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ScriptSchedulingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
