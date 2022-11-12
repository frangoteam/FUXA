import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TopicPropertyComponent } from './topic-property.component';

describe('TopicPropertyComponent', () => {
  let component: TopicPropertyComponent;
  let fixture: ComponentFixture<TopicPropertyComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ TopicPropertyComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TopicPropertyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
