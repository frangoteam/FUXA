import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { TreetableComponent } from './treetable.component';

describe('TreetableComponent', () => {
  let component: TreetableComponent;
  let fixture: ComponentFixture<TreetableComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ TreetableComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TreetableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
