import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { GraphConfigComponent } from './graph-config.component';

describe('GraphConfigComponent', () => {
  let component: GraphConfigComponent;
  let fixture: ComponentFixture<GraphConfigComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ GraphConfigComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(GraphConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
