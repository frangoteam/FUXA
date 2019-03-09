import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { HtmlSelectComponent } from './html-select.component';

describe('HtmlSelectComponent', () => {
  let component: HtmlSelectComponent;
  let fixture: ComponentFixture<HtmlSelectComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ HtmlSelectComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(HtmlSelectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
