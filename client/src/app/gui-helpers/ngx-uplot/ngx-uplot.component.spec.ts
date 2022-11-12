import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxUplotComponent } from './ngx-uplot.component';

describe('NgxUplotComponent', () => {
  let component: NgxUplotComponent;
  let fixture: ComponentFixture<NgxUplotComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NgxUplotComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NgxUplotComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
