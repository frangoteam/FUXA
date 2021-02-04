import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {FlexEventComponent} from './flex-event.component';

describe('FlexEventComponent', () => {
  let component: FlexEventComponent;
  let fixture: ComponentFixture<FlexEventComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [FlexEventComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FlexEventComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
