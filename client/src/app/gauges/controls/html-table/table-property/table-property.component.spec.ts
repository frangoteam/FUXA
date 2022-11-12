import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TablePropertyComponent } from './table-property.component';

describe('TablePropertyComponent', () => {
  let component: TablePropertyComponent;
  let fixture: ComponentFixture<TablePropertyComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ TablePropertyComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TablePropertyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
