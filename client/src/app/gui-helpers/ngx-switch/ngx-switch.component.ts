/* eslint-disable @angular-eslint/component-selector */
import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';

@Component({
    selector: 'ngx-switch',
    templateUrl: './ngx-switch.component.html',
    styleUrls: ['./ngx-switch.component.css']
})
export class NgxSwitchComponent implements AfterViewInit {

    @ViewChild('switcher', {static: false}) public switcher: ElementRef;
    @ViewChild('slider', {static: false}) public slider: ElementRef;
    @ViewChild('toggler', {static: false}) public toggler: ElementRef;
    options: SwitchOptions = new SwitchOptions();
    checked = false;
    onUpdate: any;

    constructor() {
    }

    ngAfterViewInit() {
        this.onRefresh();
    }

    onClick() {
        this.onRefresh();
        if (this.onUpdate) {
            this.onUpdate((this.checked) ? this.options.onValue.toString() : this.options.offValue.toString());
        }
    }

    onRefresh() {
        this.checked = this.switcher.nativeElement.checked;
        this.toggler.nativeElement.classList.toggle('active', this.checked);
        if (this.switcher.nativeElement.checked) {
            this.toggler.nativeElement.style.backgroundColor = this.options.onBackground;
            this.slider.nativeElement.style.backgroundColor = this.options.onSliderColor;
            this.slider.nativeElement.style.color = this.options.onTextColor;
            this.slider.nativeElement.innerHTML = this.options.onText;
        } else {
            this.toggler.nativeElement.style.backgroundColor = this.options.offBackground;
            this.slider.nativeElement.style.backgroundColor = this.options.offSliderColor;
            this.slider.nativeElement.style.color = this.options.offTextColor;
            this.slider.nativeElement.innerHTML = this.options.offText;
        }
        this.slider.nativeElement.style.lineHeight = this.options.height + 'px';
    }

    setOptions(options: SwitchOptions, force = false): boolean {
        if (force) {
            this.options = options;
            this.onRefresh();
        } else {
            setTimeout(() => {
                this.options = options;
                this.onRefresh();
            }, 200);
        }
        return true;
    }

    setValue(value: number) {
        this.switcher.nativeElement.checked = (value) ? true : false;
        this.onRefresh();
    }

    bindUpdate(calback: any) {
        this.onUpdate = calback;
    }
}

export class SwitchOptions {
    offValue = 0;
    onValue = 1;
    offBackground = '#ccc';
    onBackground = '#ccc';
    offText = '';
    onText = '';
    offSliderColor = '#fff';
    onSliderColor = '#0CC868';
    offTextColor = '#000';
    onTextColor = '#fff';
    fontSize = 12;
    fontFamily = '';
    radius = 0;
    height: number;
}
