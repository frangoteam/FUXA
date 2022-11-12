import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ChartUplotComponent } from './chart-uplot.component';

describe('ChartUplotComponent', () => {
  let component: ChartUplotComponent;
  let fixture: ComponentFixture<ChartUplotComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ChartUplotComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ChartUplotComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
