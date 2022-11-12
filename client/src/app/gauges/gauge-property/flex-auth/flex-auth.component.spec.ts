import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { FlexAuthComponent } from './flex-auth.component';

describe('FlexAuthComponent', () => {
  let component: FlexAuthComponent;
  let fixture: ComponentFixture<FlexAuthComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ FlexAuthComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FlexAuthComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
