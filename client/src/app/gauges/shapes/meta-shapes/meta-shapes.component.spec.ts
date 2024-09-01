import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MetaShapesComponent } from './meta-shapes.component';

describe('MetaShapesComponent', () => {
  let component: MetaShapesComponent;
  let fixture: ComponentFixture<MetaShapesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MetaShapesComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MetaShapesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
