import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { GaugeBaseComponent } from './gauge-base.component';

describe('GaugeBaseComponent', () => {
  let component: GaugeBaseComponent;
  let fixture: ComponentFixture<GaugeBaseComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ GaugeBaseComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(GaugeBaseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
