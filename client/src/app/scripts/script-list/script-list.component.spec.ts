import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ScriptListComponent } from './script-list.component';

describe('ScriptListComponent', () => {
  let component: ScriptListComponent;
  let fixture: ComponentFixture<ScriptListComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ScriptListComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ScriptListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
