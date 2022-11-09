import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { LayoutPropertyComponent } from './layout-property.component';

describe('LayoutPropertyComponent', () => {
  let component: LayoutPropertyComponent;
  let fixture: ComponentFixture<LayoutPropertyComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ LayoutPropertyComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(LayoutPropertyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
