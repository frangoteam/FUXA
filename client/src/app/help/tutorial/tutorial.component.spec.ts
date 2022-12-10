import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { TutorialComponent } from './tutorial.component';

describe('TutorialComponent', () => {
  let component: TutorialComponent;
  let fixture: ComponentFixture<TutorialComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ TutorialComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TutorialComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
