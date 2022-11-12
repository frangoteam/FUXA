import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ReportEditorComponent } from './report-editor.component';

describe('ReportEditorComponent', () => {
  let component: ReportEditorComponent;
  let fixture: ComponentFixture<ReportEditorComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ReportEditorComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ReportEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
