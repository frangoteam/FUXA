import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AppSettingsComponent } from './app-settings.component';

describe('AppSettingsComponent', () => {
  let component: AppSettingsComponent;
  let fixture: ComponentFixture<AppSettingsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AppSettingsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AppSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
