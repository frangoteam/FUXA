import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SelOptionsComponent } from './sel-options.component';

describe('SelOptionsComponent', () => {
  let component: SelOptionsComponent;
  let fixture: ComponentFixture<SelOptionsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SelOptionsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SelOptionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
