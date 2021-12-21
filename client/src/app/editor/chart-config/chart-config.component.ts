import { Component, OnInit, Inject, ViewChild } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA, MatSelectionList } from '@angular/material';

import { TranslateService } from '@ngx-translate/core';

import { Utils } from '../../_helpers/utils';
import { Device, DevicesUtils, Tag } from '../../_models/device';
import { Chart, ChartLine } from '../../_models/chart';
import { ConfirmDialogComponent } from '../../gui-helpers/confirm-dialog/confirm-dialog.component';
import { DeviceTagDialog } from '../../device/device.component';

@Component({
  selector: 'app-chart-config',
  templateUrl: './chart-config.component.html',
  styleUrls: ['./chart-config.component.css']
})
export class ChartConfigComponent implements OnInit {

    @ViewChild(MatSelectionList) selTags: MatSelectionList;

    selectedChart = <Chart>{ id: null, name: null, lines: [] };
    selectedDevice = { id: null, name: null, tags: []};
    selectedTags = [];
    data = { charts: [], devices: [] };
    defaultColor = Utils.defaultColor;
    lineColor = Utils.lineColor;

    lineInterpolationType = [{ text: 'chart.config-interpo-linear', value: 0 }, { text: 'chart.config-interpo-stepAfter', value: 1 }, 
                    { text: 'chart.config-interpo-stepBefore', value: 2 }, { text: 'chart.config-interpo-spline', value: 3 }];

    constructor(
        public dialog: MatDialog,
        public dialogRef: MatDialogRef<ChartConfigComponent>,
        private translateService: TranslateService,
        @Inject(MAT_DIALOG_DATA) public param: any) {
            this.data.charts = param.charts;
            Object.values(param.devices).forEach(device => {
                let devicobj = Object.assign({}, <Device>device);
                devicobj.tags = (<Device>device).tags;
                this.data.devices.push(devicobj);
            });
    }

    ngOnInit() {
        for (let i = 0; i < this.lineInterpolationType.length; i++) {
            this.translateService.get(this.lineInterpolationType[i].text).subscribe((txt: string) => { this.lineInterpolationType[i].text = txt });
        }
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.dialogRef.close({ charts: this.data.charts });
    }

    onRemoveChart(index: number) {
        let msg = '';
        this.translateService.get('msg.chart-remove', { value: this.data.charts[index].name }).subscribe((txt: string) => { msg = txt });
        let dialogRef = this.dialog.open(ConfirmDialogComponent, {
            data: { msg: msg },
            position: { top: '60px' }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.data.charts.splice(index, 1);
                this.selectedChart = { id: null, name: null, lines: [] };
            }
        });
    }

    onSelectChart(item: Chart) {
        this.selectedChart = item;
    }

    isChartSelected(item: Chart) {
        if (item === this.selectedChart) {
            return 'mychips-selected';
        }
    }

    onEditChart(chart) {
        let dialogRef = this.dialog.open(DialogListItem, {
            position: { top: '60px' },
            data: { name: (chart) ? chart.name : '' }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result && result.name && result.name.length > 0) {
                // this.dirty = true;
                if (chart) {
                    chart.name = result.name;
                } else {
                    let chart = <Chart>{ id: Utils.getShortGUID(), name: result.name, lines: [] };
                    this.data.charts.push(chart);
                    this.onSelectChart(chart);
                }
            }
        });
    }

    onAddChartLine(chart: Chart) {
        let dialogRef = this.dialog.open(DeviceTagDialog, {
            position: { top: '60px' },
            data: { variableId: null, devices: this.data.devices, multiSelection: true }
        });

        dialogRef.afterClosed().subscribe((result) => {
            if (result) {
                let tagsId = [];
                if (result.variablesId) {
                    tagsId = result.variablesId;
                } else if (result.variableId) {
                    tagsId.push(result.variableId);
                }
                tagsId.forEach(id => {
                    let device = DevicesUtils.getDeviceFromTagId(this.data.devices, id);
                    let tag = DevicesUtils.getTagFromTagId([device], id);
                    if (tag) {
                        let exist = chart.lines.find(line => line.id === tag.id)
                        if (!exist) {
                            const myCopiedObject: ChartLine = {id: tag.id, name: this.getTagLabel(tag), device: device.name, color: this.getNextColor(), 
                                label: this.getTagLabel(tag), yaxis: 1 };
                            chart.lines.push(myCopiedObject);
                        }
                    }
                });
            }
        });
    }

    editChartLine(line: ChartLine) {
        let dialogRef = this.dialog.open(DialogChartLine, {
            position: { top: '60px' },
            data: <ChartLine>{ id: line.id, device: line.device, name: line.name, label: line.label, color: line.color, yaxis: line.yaxis, 
                lineInterpolation: line.lineInterpolation, fill: line.fill, lineInterpolationType: this.lineInterpolationType }
        });
        dialogRef.afterClosed().subscribe((result: ChartLine) => {
            if (result) {
                line.label = result.label;
                line.color = result.color;
                line.yaxis = result.yaxis;
                line.lineInterpolation = result.lineInterpolation;
                line.fill = result.fill;
            }
        });
    }

    removeChartLine(tag) {
        for (let i = 0; i < this.selectedTags.length; i++) {
            if (tag.id === this.selectedTags[i].id) {
                this.selectedTags.splice(i, 1)
                break;
            }
        }
        for (let i = 0; i < this.selectedChart.lines.length; i++) {
            if (this.selectedChart.lines[i].id === tag.id) {
                this.selectedChart.lines.splice(i, 1);
                break;
            }
        }
    }

    isDeviceSelected(device) {
        if (device && device.name === this.selectedDevice.name) {
            return 'list-item-selected';
        }
    }

    getTagLabel(tag) {
        if (tag.label) {
            return tag.label;
        } else {
            return tag.name;
        }
    }

    getDeviceTagName(line: ChartLine) {
        let devices = this.data.devices.filter(x => x.name === line.device);
        if (devices && devices.length > 0) {
            let tags = Object.values<Tag>(devices[0].tags);
            for (let i = 0; i < tags.length; i++) {
                if (line.id === tags[i].id) {
                    return this.getTagLabel(tags[i]);
                }
            }
        }
        return '';
    }

    getNextColor() {
        for (let x = 0; x < this.lineColor.length; x++) {
            let found = false;
            if (this.selectedChart.lines) {
                for (let i = 0; i < this.selectedChart.lines.length; i++) {
                    if (this.selectedChart.lines[i].color === this.lineColor[x]) {
                        found = true;
                    }
                }
            }
            if (!found) {
                return this.lineColor[x];
            }
        }
        return Utils.lineColor[0];
    }

    getLineInterpolationName(line: ChartLine) {
        let type = this.lineInterpolationType.find((type) => type.value === line.lineInterpolation);
        if (type) {
            return type.text;
        }
        return '';
    }
}

@Component({
    selector: 'dialog-list-item',
    templateUrl: './list-item.dialog.html',
})
export class DialogListItem {
    // defaultColor = Utils.defaultColor;
    constructor(
        public dialogRef: MatDialogRef<DialogListItem>,
        @Inject(MAT_DIALOG_DATA) public data: any) { }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.dialogRef.close(true);
    }
}

@Component({
    selector: 'dialog-chart-line',
    templateUrl: './chart-line.dialog.html',
    styleUrls: ['./chart-config.component.css']
})
export class DialogChartLine {
    defaultColor = Utils.defaultColor;
    chartAxesType = [1, 2, 3, 4];

    constructor(
        public dialogRef: MatDialogRef<DialogChartLine>,
        @Inject(MAT_DIALOG_DATA) public data: any) { 
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.dialogRef.close(this.data);
    }
}