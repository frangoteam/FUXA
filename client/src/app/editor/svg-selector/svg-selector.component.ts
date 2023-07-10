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
    }

    svgElements: ISvgElement[] = [];
    svgElementSelected: ISvgElement;

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
}

export interface IElementPreview {
    element: ISvgElement;
    preview: boolean;
}
