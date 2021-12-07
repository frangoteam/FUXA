import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { EventsViewComponent } from './events-view.component';

describe('EventsViewComponent', () => {
  let component: EventsViewComponent;
  let fixture: ComponentFixture<EventsViewComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ EventsViewComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(EventsViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
