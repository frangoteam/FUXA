import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import {FuxaViewComponent} from './fuxa-view.component';

describe('FuxaViewComponent', () => {
  let component: FuxaViewComponent;
  let fixture: ComponentFixture<FuxaViewComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [FuxaViewComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FuxaViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
