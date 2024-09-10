import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ISvgElement } from '../../_models/hmi';

@Component({
    selector: 'app-svg-selector',
    templateUrl: './svg-selector.component.html',
    styleUrls: ['./svg-selector.component.scss']
})
export class SvgSelectorComponent {

    @Output() onEdit: EventEmitter<ISvgElement> = new EventEmitter();
    @Output() onSelect: EventEmitter<ISvgElement> = new EventEmitter();
    @Output() onPreview: EventEmitter<IElementPreview> = new EventEmitter();
    @Input('selected') set selected(element: ISvgElement) {
        this.svgElementSelected = element;
    }
    @Input('elements') set elements(values: ISvgElement[]) {
        this.svgElements = values;
        this.filteredSvgElements = values;
    }

    svgElements: ISvgElement[] = [];
    filteredSvgElements: ISvgElement[] = [];
    svgElementSelected: ISvgElement;
    filterText: string;

    constructor() { }

    onSvgElementPreview(element: ISvgElement, preview: boolean) {
        this.onPreview?.emit(<IElementPreview>{element, preview});
    }

    onSelected(element: ISvgElement) {
        this.onSelect?.emit(element);
    }

    onEditElement(element: ISvgElement) {
        this.onSelect?.emit(element);
        setTimeout(() => {
            this.onEdit?.emit(element);
        }, 500);
    }

    isSelected(element: ISvgElement) {
        return element?.id === this.svgElementSelected?.id;
    }
    
    filterElements(): void {
        if (!this.filterText) {
          this.filteredSvgElements = this.svgElements;
        } else {
          try {
            const regex = new RegExp(this.filterText, 'i');
            this.filteredSvgElements = this.svgElements.filter(el => regex.test(el.name));
          } catch (error) {
            this.filteredSvgElements = [];
          }
        }
    }  
}

export interface IElementPreview {
    element: ISvgElement;
    preview: boolean;
}
