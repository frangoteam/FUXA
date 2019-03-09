import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DeviceMapComponent } from './device-map.component';

describe('DeviceMapComponent', () => {
  let component: DeviceMapComponent;
  let fixture: ComponentFixture<DeviceMapComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ DeviceMapComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DeviceMapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
