import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { HtmlChartComponent } from './html-chart.component';

describe('HtmlChartComponent', () => {
  let component: HtmlChartComponent;
  let fixture: ComponentFixture<HtmlChartComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ HtmlChartComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(HtmlChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
