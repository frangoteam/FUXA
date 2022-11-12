import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DeviceWebapiPropertyDialogComponent } from './device-webapi-property-dialog.component';

describe('DeviceWebapiPropertyDialogComponent', () => {
  let component: DeviceWebapiPropertyDialogComponent;
  let fixture: ComponentFixture<DeviceWebapiPropertyDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ DeviceWebapiPropertyDialogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DeviceWebapiPropertyDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
