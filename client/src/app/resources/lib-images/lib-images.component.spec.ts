import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { LibImagesComponent } from './lib-images.component';

describe('LibImagesComponent', () => {
  let component: LibImagesComponent;
  let fixture: ComponentFixture<LibImagesComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ LibImagesComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(LibImagesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
