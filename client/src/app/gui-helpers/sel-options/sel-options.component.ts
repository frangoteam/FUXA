/* eslint-disable @angular-eslint/component-selector */
import { Component, Input } from '@angular/core';

@Component({
    selector: 'sel-options',
    templateUrl: './sel-options.component.html',
    styleUrls: ['./sel-options.component.css']
})
export class SelOptionsComponent {

    @Input() disabled: any;
    @Input() selected = [];
    @Input() options = [];
    @Input() extSelected;

    constructor() { }

}
