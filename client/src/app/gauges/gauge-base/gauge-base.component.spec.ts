import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { GaugeBaseComponent } from './gauge-base.component';

describe('GaugeBaseComponent', () => {
  let component: GaugeBaseComponent;
  let fixture: ComponentFixture<GaugeBaseComponent>;

  beforeEach(async(() => {
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
