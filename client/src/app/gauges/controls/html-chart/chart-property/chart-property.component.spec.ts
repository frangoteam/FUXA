import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ChartPropertyComponent } from './chart-property.component';

describe('ChartPropertyComponent', () => {
  let component: ChartPropertyComponent;
  let fixture: ComponentFixture<ChartPropertyComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ChartPropertyComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ChartPropertyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
