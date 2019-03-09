import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { GaugeProgressComponent } from './gauge-progress.component';

describe('GaugeProgressComponent', () => {
  let component: GaugeProgressComponent;
  let fixture: ComponentFixture<GaugeProgressComponent>;

  beforeEach(async(() => {
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
