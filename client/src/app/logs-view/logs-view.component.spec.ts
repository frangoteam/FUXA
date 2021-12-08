import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { LogsViewComponent } from './logs-view.component';

describe('LogsViewComponent', () => {
  let component: LogsViewComponent;
  let fixture: ComponentFixture<LogsViewComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ LogsViewComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(LogsViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
