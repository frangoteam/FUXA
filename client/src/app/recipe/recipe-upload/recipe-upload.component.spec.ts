import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecipeUploadComponent } from './recipe-upload.component';

describe('RecipeUploadComponent', () => {
  let component: RecipeUploadComponent;
  let fixture: ComponentFixture<RecipeUploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RecipeUploadComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecipeUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
