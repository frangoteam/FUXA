/* tslint:disable:no-unused-variable */
import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {FlexVariablesMappingComponent} from './flex-variables-mapping.component';

describe('FlexVariableMappingComponent', () => {
  let component: FlexVariablesMappingComponent;
  let fixture: ComponentFixture<FlexVariablesMappingComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [FlexVariablesMappingComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FlexVariablesMappingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
