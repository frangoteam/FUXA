/* tslint:disable:no-unused-variable */
import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {FlexVariableMappingComponent} from './flex-variable.component';

describe('FlexVariableComponent', () => {
  let component: FlexVariableMappingComponent;
  let fixture: ComponentFixture<FlexVariableMappingComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [FlexVariableMappingComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FlexVariableMappingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
