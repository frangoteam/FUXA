import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { HtmlTableComponent } from './html-table.component';

describe('HtmlTableComponent', () => {
  let component: HtmlTableComponent;
  let fixture: ComponentFixture<HtmlTableComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ HtmlTableComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(HtmlTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
