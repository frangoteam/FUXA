import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { NgxSwitchComponent } from './ngx-switch.component';

describe('NgxSwitchComponent', () => {
  let component: NgxSwitchComponent;
  let fixture: ComponentFixture<NgxSwitchComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ NgxSwitchComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NgxSwitchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
