import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ScriptPermissionComponent } from './script-permission.component';

describe('ScriptPermissionComponent', () => {
  let component: ScriptPermissionComponent;
  let fixture: ComponentFixture<ScriptPermissionComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ScriptPermissionComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ScriptPermissionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
