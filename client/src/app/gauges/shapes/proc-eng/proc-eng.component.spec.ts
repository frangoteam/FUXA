/* tslint:disable:no-unused-variable */
import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {ProcEngComponent} from './proc-eng.component';

describe('ProcEngComponent', () => {
  let component: ProcEngComponent;
  let fixture: ComponentFixture<ProcEngComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ProcEngComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ProcEngComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
