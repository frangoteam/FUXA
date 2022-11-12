import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AlarmViewComponent } from './alarm-view.component';

describe('AlarmViewComponent', () => {
  let component: AlarmViewComponent;
  let fixture: ComponentFixture<AlarmViewComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AlarmViewComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AlarmViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
