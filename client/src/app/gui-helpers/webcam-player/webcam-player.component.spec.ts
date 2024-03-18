import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WebcamPlayerComponent } from './webcam-player.component';

describe('WebcamPlayerComponent', () => {
  let component: WebcamPlayerComponent;
  let fixture: ComponentFixture<WebcamPlayerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ WebcamPlayerComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WebcamPlayerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
