import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {GaugePropertyComponent} from './gauge-property.component';

describe('GaugePropertyComponent', () => {
  let component: GaugePropertyComponent;
  let fixture: ComponentFixture<GaugePropertyComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [GaugePropertyComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(GaugePropertyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
