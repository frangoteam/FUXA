import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { ViewChild, ElementRef } from '@angular/core';

@Component({
  selector: 'dynamic-component',
  templateUrl: 'dynamic.component.html',
  styleUrls: ['./dynamic.component.css']
})
export class DynamicComponent implements OnInit, OnDestroy {

  @Input() position = { x: 0, y: 0 };
  @Input() size = { width: 0, height: 0 };
  @Input() message: string;
  @ViewChild('dataContainer') dataContainer: ElementRef;

  public closeComponent;

  constructor() { }

  ngOnInit() {
    this.dataContainer.nativeElement.innerHTML = this.message;
  }

  ngOnDestroy() {
  }

  close() {
    if (this.closeComponent) {
      this.closeComponent.destroy();
    }
  }
}
