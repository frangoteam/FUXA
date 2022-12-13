import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { TagPropertyComponent } from './tag-property.component';

describe('TagPropertyComponent', () => {
  let component: TagPropertyComponent;
  let fixture: ComponentFixture<TagPropertyComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ TagPropertyComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TagPropertyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
