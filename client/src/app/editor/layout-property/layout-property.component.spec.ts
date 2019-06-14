import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { LayoutPropertyComponent } from './layout-property.component';

describe('LayoutPropertyComponent', () => {
  let component: LayoutPropertyComponent;
  let fixture: ComponentFixture<LayoutPropertyComponent>;

  beforeEach(async(() => {
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
