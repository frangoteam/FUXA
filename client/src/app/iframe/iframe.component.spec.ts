import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { IframeComponent } from './iframe.component';

describe('IframeComponent', () => {
  let component: IframeComponent;
  let fixture: ComponentFixture<IframeComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ IframeComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(IframeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
