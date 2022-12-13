import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { TagOptionsComponent } from './tag-options.component';

describe('TagOptionsComponent', () => {
  let component: TagOptionsComponent;
  let fixture: ComponentFixture<TagOptionsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ TagOptionsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TagOptionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
