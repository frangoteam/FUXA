/* tslint:disable:no-unused-variable */
import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {FlexVariableMapComponent} from './flex-variable-map.component';

describe('FlexVariableMapComponent', () => {
  let component: FlexVariableMapComponent;
  let fixture: ComponentFixture<FlexVariableMapComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [FlexVariableMapComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FlexVariableMapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
