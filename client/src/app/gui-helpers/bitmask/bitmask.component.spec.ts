/* tslint:disable:no-unused-variable */
import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DebugElement } from '@angular/core';

import { BitmaskComponent } from './bitmask.component';

describe('BitmaskComponent', () => {
  let component: BitmaskComponent;
  let fixture: ComponentFixture<BitmaskComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ BitmaskComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(BitmaskComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
