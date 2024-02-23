/* eslint-disable @angular-eslint/component-class-suffix */
import { Component, OnInit, Inject, ViewChild } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSelectionList } from '@angular/material/list';

import { TranslateService } from '@ngx-translate/core';
import { ProjectService } from '../../_services/project.service';

import { Utils } from '../../_helpers/utils';
import { Device, DevicesUtils, Tag } from '../../_models/device';
import { Chart, ChartLine } from '../../_models/chart';
import { ConfirmDialogComponent } from '../../gui-helpers/confirm-dialog/confirm-dialog.component';
import { EditNameComponent } from '../../gui-helpers/edit-name/edit-name.component';
import { DeviceTagSelectionComponent, DeviceTagSelectionData } from '../../device/device-tag-selection/device-tag-selection.component';

@Component({
  selector: 'app-chart-config',
  templateUrl: './chart-config.component.html',
  styleUrls: ['./chart-config.component.css']
})
export class ChartConfigComponent implements OnInit {

    @ViewChild(MatSelectionList, {static: false}) selTags: MatSelectionList;

    selectedChart = <Chart>{ id: null, name: null, lines: [] };
    selectedDevice = { id: null, name: null, tags: []};
    data = <IDataChartConfig>{ charts: [], devices: [] };
    defaultColor = Utils.defaultColor;
    lineColor = Utils.lineColor;

    lineInterpolationType = [{ text: 'chart.config-interpo-linear', value: 0 }, { text: 'chart.config-interpo-stepAfter', value: 1 },
                    { text: 'chart.config-interpo-stepBefore', value: 2 }, { text: 'chart.config-interpo-spline', value: 3 }];

    constructor(
        public dialog: MatDialog,
        public dialogRef: MatDialogRef<ChartConfigComponent>,
        private translateService: TranslateService,
        private projectService: ProjectService) {
            this.loadData();
    }

    ngOnInit() {
        for (let i = 0; i < this.lineInterpolationType.length; i++) {
            this.translateService.get(this.lineInterpolationType[i].text).subscribe((txt: string) => { this.lineInterpolationType[i].text = txt; });
        }
    }

    loadData() {
        this.data.charts = JSON.parse(JSON.stringify(this.projectService.getCharts()));
        this.data.devices = [];
        let devices = this.projectService.getDevices();
        Object.values(devices).forEach(device => {
            let devicobj = Object.assign({}, <Device>device);
            devicobj.tags = (<Device>device).tags;
            this.data.devices.push(devicobj);
        });
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.projectService.setCharts(this.data.charts);
        this.dialogRef.close(<IDataChartResult> { charts: this.data.charts, selected: this.selectedChart });
    }

    onRemoveChart(index: number) {
        let msg = '';
        this.translateService.get('msg.chart-remove', { value: this.data.charts[index].name }).subscribe((txt: string) => { msg = txt; });
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

    onEditChart(chart: Chart) {
        let title = 'dlg.item-title';
        let label = 'dlg.item-name';
        let error = 'dlg.item-name-error';
        let exist = this.data.charts.map((c) => { if (!chart || chart.name !== c.name) {return c.name;} });
        this.translateService.get(title).subscribe((txt: string) => { title = txt; });
        this.translateService.get(label).subscribe((txt: string) => { label = txt; });
        this.translateService.get(error).subscribe((txt: string) => { error = txt; });
        let dialogRef = this.dialog.open(EditNameComponent, {
            position: { top: '60px' },
            data: { name: (chart) ? chart.name : '', title: title, label: label, exist: exist, error: error }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result && result.name && result.name.length > 0) {
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
        let dialogRef = this.dialog.open(DeviceTagSelectionComponent, {
            disableClose: true,
            position: { top: '60px' },
            data: <DeviceTagSelectionData> {
                variableId: null,
                multiSelection: true
            }
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
                        let exist = chart.lines.find(line => line.id === tag.id);
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
        for (let i = 0; i < this.selectedChart.lines.length; i++) {
            if (this.selectedChart.lines[i].id === tag.id) {
                this.selectedChart.lines.splice(i, 1);
                break;
            }
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


interface IDataChartConfig {
    charts: Chart[];
    devices: Device[];
}

export interface IDataChartResult {
    charts: Chart[];
    selected: Chart;
}
