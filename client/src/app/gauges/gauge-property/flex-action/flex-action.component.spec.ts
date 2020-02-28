/* tslint:disable:no-unused-variable */
import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DebugElement } from '@angular/core';

import { FlexActionComponent } from './flex-action.component';

describe('FlexActionComponent', () => {
  let component: FlexActionComponent;
  let fixture: ComponentFixture<FlexActionComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ FlexActionComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FlexActionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
