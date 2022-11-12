import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TagOptionsComponent } from './tag-options.component';

describe('TagOptionsComponent', () => {
  let component: TagOptionsComponent;
  let fixture: ComponentFixture<TagOptionsComponent>;

  beforeEach(async(() => {
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
