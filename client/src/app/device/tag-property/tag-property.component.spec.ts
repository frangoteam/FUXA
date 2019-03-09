import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TagPropertyComponent } from './tag-property.component';

describe('TagPropertyComponent', () => {
  let component: TagPropertyComponent;
  let fixture: ComponentFixture<TagPropertyComponent>;

  beforeEach(async(() => {
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
