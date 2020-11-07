import { Component, OnInit, Inject, ViewChild } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA, MatSelectionList } from '@angular/material';

import { Utils } from '../../_helpers/utils';
import { Device } from '../../_models/device';

@Component({
  selector: 'app-chart-config',
  templateUrl: './chart-config.component.html',
  styleUrls: ['./chart-config.component.css']
})
export class ChartConfigComponent implements OnInit {

    @ViewChild(MatSelectionList) selTags: MatSelectionList;

    selectedChart = { id: null, name: null, lines: [] };
    selectedDevice = { id: null, name: null, tags: []};
    selectedTags = [];
    data = { charts: [], devices: [] };
    defaultColor = Utils.defaultColor;
    lineColor = Utils.lineColor;

    constructor(
        public dialog: MatDialog,
        public dialogRef: MatDialogRef<ChartConfigComponent>,
        @Inject(MAT_DIALOG_DATA) public param: any) {
            this.data.charts = param.charts;
            Object.values(param.devices).forEach(device => {
                let devicobj = Object.assign({}, <Device>device);
                devicobj.tags = Object.values((<Device>device).tags);
                this.data.devices.push(devicobj);
            });
        }

    ngOnInit() {
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.dialogRef.close({ charts: this.data.charts });
    }

    editChart(chart) {
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
                    this.data.charts.push({ id: Utils.getShortGUID(), name: result.name, lines: [] });
                }
            }
        });
    }

    deleteChart(chart) {
        let found = -1;
        for (let i = 0; i < this.data.charts.length; i++) {
            if (chart.id === this.data.charts[i].id) {
                found = i;
            }
        }
        if (found >= 0) {
            this.data.charts.splice(found, 1);
            this.selectedChart = { id: null, name: null, lines: [] };
        }
    }

    selectDevice(device) {
        this.selectedDevice = JSON.parse(JSON.stringify(device));
        this.loadDeviceConfig();
    }

    loadChartConfig() {
        this.selectedDevice = { id: null, name: null, tags: [] };
        this.loadDeviceConfig();
    }

    loadDeviceConfig() {
        if (this.selectedChart && this.selectedChart.lines && this.selectedDevice) {
            this.selectedChart.lines.forEach(line => {
                this.selectedDevice.tags.forEach(tag => {
                    if (line.device === this.selectedDevice.name && line.id === tag.id) {
                        tag.selected = true;
                    }
                });
            });
        }
    }

    /**
     * add or remove the selected device tags to the selected chart in char-line list
     * @param chart
     * @param device
     * @param tags
     */
    checkChartTags(chart, device, tags) {
        if (chart && chart.id) {
            let toremove = [];
            // check to remove
            if (chart.lines) {
                for (let i = 0; i < chart.lines.length; i++) {
                    if (chart.lines[i].device === device.name) {
                        let found = -1;
                        for (let x = 0; x < tags.length; x++) {
                            if (chart.lines[i].id === tags[x].id) {
                                found = i;
                                break;
                            }
                        }
                        if (found < 0) {
                            toremove.push(i);
                        }
                        // if (tags.map(x => x.id).indexOf(chart.lines[i].id) === -1) {
                        //     toremove.push(i);
                        // }
                    }
                }
            }
            // remove
            for (let i = 0; i < toremove.length; i++) {
                chart.lines.splice(toremove[i], 1);
            }
            // add if not exist
            for (let x = 0; x < tags.length; x++) {
                let found = false;
                if (chart.lines) {
                    for (let i = 0; i < chart.lines.length; i++) {
                        if (chart.lines[i].device === device.name && chart.lines[i].id === tags[x].id) {
                            found = true;
                        }
                    }
                }
                if (!found) {
                    const myCopiedObject = {};
                    myCopiedObject['id'] = tags[x].id;
                    myCopiedObject['name'] = tags[x].name;
                    myCopiedObject['device'] = device.name;
                    myCopiedObject['color'] = this.getNextColor();
                    chart.lines.push(myCopiedObject);
                }
            }
        }
    }

    tagSelectionChanged(event) {
        this.checkChartTags(this.selectedChart, this.selectedDevice, this.selectedTags);
    }

    editChartLine(tag) {
        console.log('ed ' + tag);
    }

    removeChartLine(tag) {
        let found = -1;
        for (let i = 0; i < this.selectedTags.length; i++) {
            if (tag.id === this.selectedTags[i].id) {
                found = i;
                break;
            }
        }
        if (found >= 0) {
            this.selectedTags.splice(found, 1)
        }
        this.checkChartTags(this.selectedChart, this.selectedDevice, this.selectedTags);
    }

    isChartSelected(chart) {
        if (chart === this.selectedChart) {
            return 'list-item-selected';
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

    getDeviceTagName(tag) {
        let devices = this.data.devices.filter(x => x.name === tag.device);
        if (devices && devices.length > 0) {
            let tags = devices[0].tags;
            for (let i = 0; i < tags.length; i++) {
                if (tag.id === tags[i].id) {
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
