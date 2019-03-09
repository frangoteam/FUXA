import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ValveComponent } from './valve.component';

describe('ValveComponent', () => {
  let component: ValveComponent;
  let fixture: ComponentFixture<ValveComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ValveComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ValveComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
