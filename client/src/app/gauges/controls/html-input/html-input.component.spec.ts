import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { HtmlInputComponent } from './html-input.component';

describe('HtmlInputComponent', () => {
  let component: HtmlInputComponent;
  let fixture: ComponentFixture<HtmlInputComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ HtmlInputComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(HtmlInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
