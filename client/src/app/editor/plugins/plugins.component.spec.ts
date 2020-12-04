/* tslint:disable:no-unused-variable */
import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DebugElement } from '@angular/core';

import { PluginsComponent } from './plugins.component';

describe('PluginComponent', () => {
  let component: PluginsComponent;
  let fixture: ComponentFixture<PluginsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ PluginsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PluginsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
