import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DevicePropertyComponent } from './device-property.component';

describe('DevicePropertyComponent', () => {
  let component: DevicePropertyComponent;
  let fixture: ComponentFixture<DevicePropertyComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ DevicePropertyComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DevicePropertyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
