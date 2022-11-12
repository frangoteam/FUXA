import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AlarmPropertyComponent } from './alarm-property.component';

describe('AlarmPropertyComponent', () => {
  let component: AlarmPropertyComponent;
  let fixture: ComponentFixture<AlarmPropertyComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AlarmPropertyComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AlarmPropertyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
