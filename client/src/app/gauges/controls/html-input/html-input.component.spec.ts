import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { HtmlInputComponent } from './html-input.component';

describe('HtmlInputComponent', () => {
  let component: HtmlInputComponent;
  let fixture: ComponentFixture<HtmlInputComponent>;

  beforeEach(waitForAsync(() => {
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
