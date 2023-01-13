import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxTouchKeyboardComponent } from './ngx-touch-keyboard.component';

describe('NgxTouchKeyboardComponent', () => {
  let component: NgxTouchKeyboardComponent;
  let fixture: ComponentFixture<NgxTouchKeyboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [NgxTouchKeyboardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NgxTouchKeyboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
