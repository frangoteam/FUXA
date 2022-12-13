import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { GaugeProgressComponent } from './gauge-progress.component';

describe('GaugeProgressComponent', () => {
  let component: GaugeProgressComponent;
  let fixture: ComponentFixture<GaugeProgressComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ GaugeProgressComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(GaugeProgressComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
