import { Component, AfterViewInit, OnInit, Inject, ViewChild } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';

import { TranslateService } from '@ngx-translate/core';

import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { Utils } from '../../../../_helpers/utils';
import { GaugeProperty } from '../../../../_models/hmi';
import { FlexHeadComponent } from '../../../gauge-property/flex-head/flex-head.component';
import { FlexAuthComponent } from '../../../gauge-property/flex-auth/flex-auth.component';
import { NgxNouisliderComponent, NgxNouisliderOptions } from '../../../../gui-helpers/ngx-nouislider/ngx-nouislider.component';
import { Define } from '../../../../_helpers/define';

@Component({
    selector: 'app-slider-property',
    templateUrl: './slider-property.component.html',
    styleUrls: ['./slider-property.component.css']
})
export class SliderPropertyComponent implements OnInit, AfterViewInit {

    @ViewChild('flexauth') flexAuth: FlexAuthComponent;
    @ViewChild('flexhead') flexHead: FlexHeadComponent;
    @ViewChild('slider') slider: NgxNouisliderComponent;
    property: GaugeProperty;
    options = new NgxNouisliderOptions();
    defaultColor = Utils.defaultColor;
    fonts = Define.fonts;
    name: string;
    layoutHorizontal = { width: 400, height: 80, top: 180, left: 0 };
    layoutVertical = { width: 80, height: 400, top: 20, left: 150 };
    sliderLayout = this.layoutVertical;
    orientationType = { horizontal: 'horizontal', vertical: 'vertical' };
    directionType = { ltr: 'ltr', rtl: 'rtl' };
    tooltipType = { none: 'none', hide: 'hide', show: 'show' };
    staticScala = "";


    constructor(public dialogRef: MatDialogRef<SliderPropertyComponent>,
        private translateService: TranslateService,
        private changeDetector: ChangeDetectorRef,
        @Inject(MAT_DIALOG_DATA) public data: any) {

        this.property = JSON.parse(JSON.stringify(this.data.settings.property));
        if (!this.property) {
            this.property = new GaugeProperty();
        }
        this.name = this.data.settings.name;
        this.options = <NgxNouisliderOptions>this.property.options;
        if (!this.options) {
            this.options = new NgxNouisliderOptions();
        }
    }

    ngOnInit() {
        Object.keys(this.orientationType).forEach(key => {
            this.translateService.get('slider.property-' + this.orientationType[key]).subscribe((txt: string) => { this.orientationType[key] = txt });
        });
        Object.keys(this.directionType).forEach(key => {
            this.translateService.get('slider.property-' + this.directionType[key]).subscribe((txt: string) => { this.directionType[key] = txt });
        });
        Object.keys(this.tooltipType).forEach(key => {
            this.translateService.get('slider.property-tooltip-' + this.tooltipType[key]).subscribe((txt: string) => { this.tooltipType[key] = txt });
        });
        this.sliderLayout = (this.options.orientation === 'vertical') ? this.layoutVertical : this.layoutHorizontal;
        this.options.pips.values.forEach(k => {
            if (this.staticScala.length) {
                this.staticScala += ';';
            }
            this.staticScala += k.toString();
        });  
    }

    ngAfterViewInit() {
        this.setSliderOptions();
    }    

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.data.settings.property = this.property;
        this.data.settings.property.permission = this.flexAuth.permission;
        this.data.settings.property.options = this.options;
        this.data.settings.name = this.flexAuth.name;
    }

    onChangeOptions(opt, value) {
        if (opt === 'min' || opt === 'max') {
            this.options.range[opt] = parseFloat(value);
        } else if (opt === 'step') {
            this.options[opt] = parseFloat(value);
        } else if (opt === 'staticScala') {
            this.options.pips.values = [];
            if (value) {
                let tks = value.split(';');
                tks.forEach(tk => {
                    let v = parseFloat(tk);
                    if (!isNaN(v)) {
                        this.options.pips.values.push(v);
                    }                    
                });
            }
        } else if (opt === 'tooltipType') {
            this.options.tooltip.type = value;
        } else {
            this.options[opt] = value;
        }
        this.setSliderOptions();
    }

    onChangeDirection(event) {
        this.setSliderOptions();
    }

    setSliderOptions() {
        this.sliderLayout = (this.options.orientation === 'vertical') ? this.layoutVertical : this.layoutHorizontal;
        this.changeDetector.detectChanges();
        let opt = JSON.parse(JSON.stringify(this.options));
        this.slider.setOptions(opt);
        this.slider.resize(this.sliderLayout.height, this.sliderLayout.width);
    }
    
}
