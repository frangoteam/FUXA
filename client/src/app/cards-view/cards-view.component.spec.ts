import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CardsViewComponent } from './cards-view.component';

describe('CardsViewComponent', () => {
  let component: CardsViewComponent;
  let fixture: ComponentFixture<CardsViewComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ CardsViewComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CardsViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
