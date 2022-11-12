import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NotificationPropertyComponent } from './notification-property.component';

describe('NotificationPropertyComponent', () => {
  let component: NotificationPropertyComponent;
  let fixture: ComponentFixture<NotificationPropertyComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NotificationPropertyComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NotificationPropertyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
