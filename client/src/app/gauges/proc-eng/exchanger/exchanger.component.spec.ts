import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ExchangerComponent } from './exchanger.component';

describe('ExchangerComponent', () => {
  let component: ExchangerComponent;
  let fixture: ComponentFixture<ExchangerComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ExchangerComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ExchangerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
