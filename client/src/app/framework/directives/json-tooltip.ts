import { Directive, Input, ElementRef, HostListener } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';

@Directive({
  selector: '[jsonTooltip]',
  providers: [MatTooltip]
})
export class JsonTooltipDirective {
  @Input('jsonTooltip') tooltipData: any;

  constructor(private tooltip: MatTooltip, private elementRef: ElementRef) { }

  @HostListener('mouseenter')
  onMouseEnter(): void {
    if (this.tooltipData) {
      this.tooltip.message = this.getObjectString(this.tooltipData);
      this.tooltip.show();
    }
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    this.tooltip.hide();
  }

  private getObjectString(object: any): string {
    const topicString = JSON.stringify(object, null, 4);
    return `${topicString}`;
  }
}
