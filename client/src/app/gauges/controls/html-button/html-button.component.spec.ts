import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { HtmlButtonComponent } from './html-button.component';

describe('HtmlButtonComponent', () => {
  let component: HtmlButtonComponent;
  let fixture: ComponentFixture<HtmlButtonComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ HtmlButtonComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(HtmlButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
