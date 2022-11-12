import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { IframePropertyComponent } from './iframe-property.component';

describe('IframePropertyComponent', () => {
  let component: IframePropertyComponent;
  let fixture: ComponentFixture<IframePropertyComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ IframePropertyComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(IframePropertyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
