import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SliderPropertyComponent } from './slider-property.component';

describe('SliderPropertyComponent', () => {
  let component: SliderPropertyComponent;
  let fixture: ComponentFixture<SliderPropertyComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SliderPropertyComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SliderPropertyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
