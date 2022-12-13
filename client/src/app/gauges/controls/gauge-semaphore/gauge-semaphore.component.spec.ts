import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { GaugeSemaphoreComponent } from './gauge-semaphore.component';

describe('GaugeSemaphoreComponent', () => {
  let component: GaugeSemaphoreComponent;
  let fixture: ComponentFixture<GaugeSemaphoreComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ GaugeSemaphoreComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(GaugeSemaphoreComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
