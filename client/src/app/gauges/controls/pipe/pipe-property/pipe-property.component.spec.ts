/* tslint:disable:no-unused-variable */
import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {PipePropertyComponent} from './pipe-property.component';

describe('PipePropertyComponent', () => {
  let component: PipePropertyComponent;
  let fixture: ComponentFixture<PipePropertyComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [PipePropertyComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PipePropertyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
