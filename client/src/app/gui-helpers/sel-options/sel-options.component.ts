import { Component, OnInit, Input, Output, ViewChild, ElementRef, EventEmitter } from '@angular/core';

@Component({
    selector: 'sel-options',
    templateUrl: './sel-options.component.html',
    styleUrls: ['./sel-options.component.css']
})
export class SelOptionsComponent implements OnInit {

    @Input() disabled: any;
    @Input() selected = [];
    @Input() options = [];
    @Input() extSelected;

    constructor() { }

    ngOnInit() {
    }

}
