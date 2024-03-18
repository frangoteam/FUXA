import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WebcamPlayerDialogComponent } from './webcam-player-dialog.component';

describe('WebcamPlayerDialogComponent', () => {
  let component: WebcamPlayerDialogComponent;
  let fixture: ComponentFixture<WebcamPlayerDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ WebcamPlayerDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WebcamPlayerDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
