/* tslint:disable:no-unused-variable */
import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {FlexVariableComponent} from './flex-variable.component';

describe('FlexVariableComponent', () => {
  let component: FlexVariableComponent;
  let fixture: ComponentFixture<FlexVariableComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [FlexVariableComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FlexVariableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
