/* tslint:disable:no-unused-variable */
import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DebugElement } from '@angular/core';

import { IframePropertyComponent } from './iframe-property.component';

describe('IframePropertyComponent', () => {
  let component: IframePropertyComponent;
  let fixture: ComponentFixture<IframePropertyComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ IframePropertyComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(IframePropertyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
