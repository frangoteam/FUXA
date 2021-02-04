import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {FlexHeadComponent} from './flex-head.component';

describe('FlexHeadComponent', () => {
  let component: FlexHeadComponent;
  let fixture: ComponentFixture<FlexHeadComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [FlexHeadComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FlexHeadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
