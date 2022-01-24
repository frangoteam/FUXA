import { Component, OnInit, Inject } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

import { TranslateService } from '@ngx-translate/core';
import { ProjectService } from '../../_services/project.service';

import { Utils } from '../../_helpers/utils';
import { Device, DevicesUtils, Tag } from '../../_models/device';
import { Graph, GraphSource, GraphType, GraphBarProperty, GraphBarXType } from '../../_models/graph';
import { EditNameComponent } from '../../gui-helpers/edit-name/edit-name.component';
import { ConfirmDialogComponent } from '../../gui-helpers/confirm-dialog/confirm-dialog.component';
import { DeviceTagDialog } from '../../device/device.component';

@Component({
    selector: 'app-graph-config',
    templateUrl: './graph-config.component.html',
    styleUrls: ['./graph-config.component.css']
})
export class GraphConfigComponent implements OnInit {

    selectedGraph = new Graph(GraphType.bar);
    data = { graphs: [], devices: [] };
    lineColor = Utils.lineColor;

    barXType = GraphBarXType;
    xTypeValue = Utils.getEnumKey(GraphBarXType, GraphBarXType.value);

    constructor(public dialog: MatDialog,
        private translateService: TranslateService,
        public dialogRef: MatDialogRef<GraphConfigComponent>,
        @Inject(MAT_DIALOG_DATA) public params: any,
        private projectService: ProjectService) {
            this.loadData();
    }

    ngOnInit() {
        Object.keys(this.barXType).forEach(key => {
            this.translateService.get(this.barXType[key]).subscribe((txt: string) => { this.barXType[key] = txt });
        });
    }

    loadData() {
        this.data.graphs = JSON.parse(JSON.stringify(this.projectService.getGraphs()));
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
        this.projectService.setGraphs(this.data.graphs);
        this.dialogRef.close(this.data.graphs);
    }

    onAddNewCategory() {

    }

    isSelection() {
        return (this.selectedGraph && this.selectedGraph.id) ? true : false;
    }

    onEditGraph(item: Graph) {
        let title = 'dlg.item-title';
        let label = 'dlg.item-name';
        this.translateService.get(title).subscribe((txt: string) => { title = txt });
        this.translateService.get(label).subscribe((txt: string) => { label = txt });
        let dialogRef = this.dialog.open(EditNameComponent, {
            position: { top: '60px' },
            data: { name: (item) ? item.name : '', title: title, label: label }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result && result.name && result.name.length > 0) {
                if (item) {
                    item.name = result.name;
                } else {
                    this.data.graphs.push(new Graph(GraphType.bar, Utils.getShortGUID(), result.name));
                }
            }
        });
    }

    onAddGraphSource(graph: Graph) {
        let dialogRef = this.dialog.open(DeviceTagDialog, {
            position: { top: '60px' },
            data: { variableId: null, devices: this.data.devices, multiSelection: false }
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
                        let exist = graph.sources.find(source => source.id === tag.id)
                        if (!exist) {
                            let color = this.getNextColor();
                            const myCopiedObject: GraphSource = {id: tag.id, name: this.getTagLabel(tag), device: device.name, 
                                label: this.getTagLabel(tag), color: color, fill: color };
                            graph.sources.push(myCopiedObject);
                        }
                    }
                });
            }
        });
    }

    onRemoveGraph(index: number) {
        let msg = '';
        this.translateService.get('msg.graph-remove', { value: this.data.graphs[index].name }).subscribe((txt: string) => { msg = txt });
        let dialogRef = this.dialog.open(ConfirmDialogComponent, {
            data: { msg: msg },
            position: { top: '60px' }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.data.graphs.splice(index, 1);
                this.selectedGraph = <Graph>{ id: null, name: null };
            }
        });
    }

    editGraphSource(source: GraphSource) {
        let dialogRef = this.dialog.open(DialogGraphSource, {
            position: { top: '60px' },
            data: <GraphSource>{
                id: source.id, device: source.device, name: source.name, label: source.label, color: source.color, fill: source.fill }
        });
        dialogRef.afterClosed().subscribe((result: GraphSource) => {
            if (result) {
                source.label = result.label;
                source.color = result.color;
                source.fill = result.fill;
            }
        });
    }

    removeGraphSource(source: GraphSource) {
        for (let i = 0; i < this.selectedGraph.sources.length; i++) {
            if (this.selectedGraph.sources[i].id === source.id) {
                this.selectedGraph.sources.splice(i, 1);
                break;
            }
        }
    }

    onSelectGraph(item: Graph) {
        this.selectedGraph = item;
        if (!this.selectedGraph.type) {
            this.selectedGraph.type = GraphType.bar;
        }
        if (!this.selectedGraph.property) {
            this.selectedGraph.property = new GraphBarProperty();
        }
    }

    isGraphSelected(item: Graph) {
        if (item === this.selectedGraph) {
            return 'mychips-selected';
        }
    }

    onGraphXTypeChanged(type: GraphBarXType) {
        this.selectedGraph.property.xtype = type;
    }


    getTagLabel(tag) {
        if (tag.label) {
            return tag.label;
        } else {
            return tag.name;
        }
    }

    getDeviceTagName(source: GraphSource) {
        let devices = this.data.devices.filter(x => x.name === source.device);
        if (devices && devices.length > 0) {
            let tags = Object.values<Tag>(devices[0].tags);
            for (let i = 0; i < tags.length; i++) {
                if (source.id === tags[i].id) {
                    return this.getTagLabel(tags[i]);
                }
            }
        }
        return '';
    }

    getNextColor() {
        for (let x = 0; x < this.lineColor.length; x++) {
            let found = false;
            if (this.selectedGraph.sources) {
                for (let i = 0; i < this.selectedGraph.sources.length; i++) {
                    if (this.selectedGraph.sources[i].color === this.lineColor[x]) {
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
    selector: 'dialog-graph-source',
    templateUrl: './graph-source.dialog.html',
    styleUrls: ['./graph-config.component.css']
})
export class DialogGraphSource {
    defaultColor = Utils.defaultColor;
    chartAxesType = [1, 2, 3, 4];

    constructor(
        public dialogRef: MatDialogRef<DialogGraphSource>,
        @Inject(MAT_DIALOG_DATA) public data: any) { 
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.dialogRef.close(this.data);
    }
}