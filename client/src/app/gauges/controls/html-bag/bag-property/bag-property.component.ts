import { Component, Inject, OnInit, AfterViewInit, OnChanges, SimpleChanges, ViewChild, ChangeDetectorRef } from '@angular/core';
import { Utils } from '../../../../_helpers/utils';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

import { GaugeOptions, GaugeType, } from '../../../../gui-helpers/ngx-gauge/gaugeOptions';
import { NgxGaugeComponent } from '../../../../gui-helpers/ngx-gauge/ngx-gauge.component';
import { GaugeSettings } from '../../../../_models/hmi';
import { GaugeProperty } from '../../../../_models/hmi';
import { DialogGaugePermission } from '../../../gauge-property/gauge-property.component';
import { FlexHeadComponent } from '../../../gauge-property/flex-head/flex-head.component';
import { Define } from '../../../../_helpers/define';

@Component({
    selector: 'bag-property',
    templateUrl: './bag-property.component.html',
    styleUrls: ['./bag-property.component.css']
})
export class BagPropertyComponent implements OnInit, AfterViewInit, OnChanges {

    @ViewChild("ngauge") ngauge: NgxGaugeComponent;
	@ViewChild('flexhead') flexHead: FlexHeadComponent;

    gauge = {
        value: 30
    }

	property: GaugeProperty;
    gaugeTypeEnum = GaugeType;
    gaugeType = GaugeType.Gauge;
    options: any = new GaugeOptions();
    optionsGauge = new GaugeOptions();
    optionsDonut = new GaugeOptions();
    optionsZones = new GaugeOptions();
    optcfg: any = new GaugeOptions();
    defaultColor = Utils.defaultColor;
    fonts = Define.fonts;

    constructor(private cdRef: ChangeDetectorRef,
                public dialog: MatDialog,
                public dialogRef: MatDialogRef<BagPropertyComponent>,
                @Inject(MAT_DIALOG_DATA) public data: any) { 
        this.optionsGauge = this.getDefaultOptions(GaugeType.Gauge);
        this.optionsDonut = this.getDefaultOptions(GaugeType.Donut);
        this.optionsZones = this.getDefaultOptions(GaugeType.Zones);
        this.options = this.optionsGauge;
        this.property = JSON.parse(JSON.stringify(this.data.settings.property));
        if (!this.property) {
			this.property = new GaugeProperty();
        }
    }

    ngOnInit() { 
    }

    ngAfterViewInit() {
        setTimeout(() => {
            this.gaugeType = GaugeType.Gauge;
            if (this.property.options) {
                this.options = this.property.options;
                this.gaugeType = this.options.type;
                if (this.gaugeType === GaugeType.Donut) {
                    this.optionsDonut = this.options;
                } else if (this.gaugeType === GaugeType.Zones) {
                    this.optionsZones = this.options;
                } else {
                    this.optionsGauge = this.options;
                }
            }
            this.onGaugeChange(this.gaugeType);
            this.cdRef.detectChanges();    
        }, 500);
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.data.settings.property = this.flexHead.getProperty();
        this.options.type = this.gaugeType;
        this.data.settings.property.options = this.options;
    }

    onEditPermission() {
		let permission = this.property.permission;
		let dialogRef = this.dialog.open(DialogGaugePermission, {
			position: { top: '60px' },
			data: { permission: permission }
		});

		dialogRef.afterClosed().subscribe(result => {
			if (result) {
				this.property.permission = result.permission;
			}
		});
	}

    ngOnChanges(changes: SimpleChanges) {
        console.log('changes');
    }

    onGaugeChange(type: GaugeType) {
        if (type === GaugeType.Donut) {
            this.gaugeType = GaugeType.Donut;
            this.initOptionsToConfig(this.optionsDonut);
            this.initDonut();
        } else if (type === GaugeType.Zones) {
            this.gaugeType = GaugeType.Zones;
            this.initOptionsToConfig(this.optionsZones);
            this.initZones();
        } else {
            this.gaugeType = GaugeType.Gauge;
            this.initOptionsToConfig(this.optionsGauge);
            this.initGauge();
        }
        this.cdRef.detectChanges();
    }

    onChangeValue(value) {
        this.ngauge.setValue(value);
    }

    onChangeOptions(opt, value) {
        this.optcfg[opt] = value;
        this.configToOptions(this.optcfg[opt], opt);
        this.setGaugeOptions();
    }

    onChangeOptionsPointer(opt, value) {
        this.options.pointer[opt] = value;
        if (opt === 'pointerLength') {
            this.options.pointer.length = value / 100;
        } else if (opt === 'pointerStrokeWidth') {
            this.options.pointer.strokeWidth = value / 1000;
        }
        this.setGaugeOptions();
    }

    onChangeOptionsTicks(opt, value) {
        this.options.renderTicks[opt] = value;
        if (opt === 'divLength') {
            this.options.renderTicks.divLength = value / 100;
        } else if (opt === 'divWidth') {
            this.options.renderTicks.divWidth = value / 10;
        } else if (opt === 'subLength') {
            this.options.renderTicks.subLength = value / 100;
        } else if (opt === 'subWidth') {
            this.options.renderTicks.subWidth = value / 10;
        }
        this.setGaugeOptions();
    }

    onChangeTicks(event) {
        this.options.ticksEnabled = event;
        if (event) {
            let opt = new GaugeOptions();
            this.options.renderTicks = JSON.parse(JSON.stringify(opt.renderTicks));
        } else {
            this.options.renderTicks = {};
        }
        this.onGaugeChange(this.gaugeType);
    }

    onChangeOptionsLabels(opt: string, value: any) {
        if (opt === 'labels') {
            let labels = [];
            if (value) {
                let tks = value.split(';');
                tks.forEach(tk => {
                    let v = parseFloat(tk);
                    if (!isNaN(v)) {
                        labels.push(v);
                    }                    
                });
            }
            this.options.staticLabels = { labels: labels, font: this.options.staticFontSize + 'px Sans-serif', color: this.options.staticFontColor };
            this.checkFontFamily();
            this.onGaugeChange(this.gaugeType);
        } else if (opt === 'fontSize') {
            this.options.staticFontSize = value;
            if (this.options.staticLabels) {
                this.options.staticLabels.font = this.options.staticFontSize + 'px Sans-serif' ;
                this.checkFontFamily();
                this.setGaugeOptions();
            }
        } else if (opt === 'labelsColor') {
            this.options.staticFontColor = value;
            if (this.options.staticLabels) {
                this.options.staticLabels.color = this.options.staticFontColor;
                this.setGaugeOptions();
            }
        } else if (opt === 'fontFamily') {
            this.options.fontFamily = value;
            this.checkFontFamily();
            this.setGaugeOptions();
        }
    }

    onAddZone() {
        if (!this.optcfg.staticZones) {
            this.optcfg.staticZones = [];
        }
        if (this.optcfg.staticZones.length < 5) {
            this.optcfg.staticZones.push({ min: null, max: null, strokeStyle: null});
        }
        this.options.staticZones = this.optcfg.staticZones;
        this.onGaugeChange(this.gaugeType);
    }

    onRemoveZone(index) {
        this.optcfg.staticZones.splice(index, 1);
        if (this.optcfg.staticZones.length <= 0) {
            delete this.optcfg.staticZones;
            delete this.options.staticZones;
        } else {
            this.options.staticZones = this.optcfg.staticZones;
        }
        this.onGaugeChange(this.gaugeType);
    }

    
    onChangeStaticZones() {
        this.options.staticZones = this.optcfg.staticZones;
        this.setGaugeOptions();
    }

    private checkFontFamily() {
        if (this.options.staticLabels && this.options.fontFamily) {
            this.options.staticLabels.font = this.options.staticFontSize + 'px ' + this.options.fontFamily;
        }
    }

    private initGauge() {
        this.setGaugeOptions();
        this.options = this.optionsGauge;
        this.ngauge.init(GaugeType.Gauge);
    }

    private initDonut() {
        this.setGaugeOptions();
        this.options = this.optionsDonut;
        this.ngauge.init(GaugeType.Donut);
    }

    private initZones() {
        this.setGaugeOptions();
        this.options = this.optionsZones;
        this.ngauge.init(GaugeType.Zones);
    }

    private setGaugeOptions() {
        if (this.gaugeType === GaugeType.Donut) {
            this.ngauge.setOptions(this.optionsDonut);
        } else if (this.gaugeType === GaugeType.Zones) {
            this.ngauge.setOptions(this.optionsZones);
        } else {
            this.ngauge.setOptions(this.optionsGauge);
        }
    }

    private initOptionsToConfig(options: GaugeOptions) {
        this.optcfg = JSON.parse(JSON.stringify(options));
        this.optcfg.angle *= 100;
        this.optcfg.lineWidth *= 100;
        this.optcfg.radiusScale *= 100;
        this.optcfg.pointer.length *= 100;
        this.optcfg.pointer.strokeWidth *= 1000;
        if (this.optcfg.renderTicks) {
            if (this.optcfg.renderTicks.divLength) {
                this.optcfg.renderTicks.divLength *= 100;
            }
            if (this.optcfg.renderTicks.divWidth) {
                this.optcfg.renderTicks.divWidth *= 10;
            }
            if (this.optcfg.renderTicks.subLength) {
                this.optcfg.renderTicks.subLength *= 100;
            }
            if (this.optcfg.renderTicks.subWidth) {
                this.optcfg.renderTicks.subWidth *= 10;
            }
        }
        this.optcfg.staticLabelsText = '';
        if (this.optcfg.staticLabels && this.optcfg.staticLabels.labels.length) {
            this.optcfg.staticLabels.labels.forEach(lb => {
                if (this.optcfg.staticLabelsText) {
                    this.optcfg.staticLabelsText += ';';
                }
                this.optcfg.staticLabelsText += lb;
            });
        }
    }

    private configToOptions(value, opt) {
        if (opt === 'angle' || opt === 'lineWidth' || opt === 'radiusScale') {
            value /= 100;
        }
        this.options[opt] = value;
    }

    private getDefaultOptions(type: GaugeType) {
        if (type === GaugeType.Zones) {
            var opts = new GaugeOptions();
            opts.angle = -0.25;
            opts.lineWidth = 0.2;
            opts.radiusScale = 0.9;
            opts.pointer.length = 0.6;
            opts.pointer.strokeWidth = 0.05;
            return opts;
        } else if (type === GaugeType.Donut) {
            var optsd = new GaugeOptions();
            optsd.angle = 0.3;
            optsd.lineWidth = 0.1;
            optsd.radiusScale = 0.8;
            optsd.renderTicks.divisions = 0;
            optsd.renderTicks.divWidth = 0;
            optsd.renderTicks.divLength = 0;
            optsd.renderTicks.subDivisions = 0;
            optsd.renderTicks.subWidth = 0;
            optsd.renderTicks.subLength = 0;
            delete optsd.staticLabels;
            delete optsd.staticZones;
            optsd.ticksEnabled = false;
            return optsd;
        } else {
            var optsa: any = new GaugeOptions();
            delete optsa.staticLabels;
            delete optsa.staticZones;
            optsa.ticksEnabled = false;
            optsa.renderTicks = {};
            optsa.staticFontSize = 0;
            optsa.staticLabelsText = '';
            return optsa;
        }
    }
}

