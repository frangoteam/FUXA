import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ChartConfigComponent } from './chart-config.component';

describe('ChartConfigComponent', () => {
  let component: ChartConfigComponent;
  let fixture: ComponentFixture<ChartConfigComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ChartConfigComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ChartConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
