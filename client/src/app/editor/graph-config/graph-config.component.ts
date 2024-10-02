/* eslint-disable @angular-eslint/component-class-suffix */
import { Component, OnInit, Inject } from '@angular/core';
import { MatLegacyDialog as MatDialog, MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';

import { TranslateService } from '@ngx-translate/core';
import { ProjectService } from '../../_services/project.service';

import { Utils } from '../../_helpers/utils';
import { Device, DevicesUtils, Tag } from '../../_models/device';
import { Graph, GraphSource, GraphType, GraphBarProperty, GraphBarXType, GraphBarDateFunctionType, GraphBarFunction, GraphBarDateFunction } from '../../_models/graph';
import { EditNameComponent } from '../../gui-helpers/edit-name/edit-name.component';
import { ConfirmDialogComponent } from '../../gui-helpers/confirm-dialog/confirm-dialog.component';
import { DeviceTagSelectionComponent, DeviceTagSelectionData } from '../../device/device-tag-selection/device-tag-selection.component';
import { GraphSourceEditComponent } from './graph-source-edit/graph-source-edit.component';

@Component({
    selector: 'app-graph-config',
    templateUrl: './graph-config.component.html',
    styleUrls: ['./graph-config.component.css']
})
export class GraphConfigComponent implements OnInit {

    selectedGraph = new Graph(GraphType.bar);
    data = <IDataGraphConfig>{ graphs: [], devices: [] };
    lineColor = Utils.lineColor;

    barXType = GraphBarXType;
    xTypeValue = Utils.getEnumKey(GraphBarXType, GraphBarXType.value);
    xTypeDate = Utils.getEnumKey(GraphBarXType, GraphBarXType.date);
    barDateFunctionType = GraphBarDateFunctionType;
    dateFunction = new GraphBarFunction();

    constructor(public dialog: MatDialog,
        private translateService: TranslateService,
        public dialogRef: MatDialogRef<GraphConfigComponent>,
        @Inject(MAT_DIALOG_DATA) public params: any,
        private projectService: ProjectService) {
            this.loadData();
    }

    ngOnInit() {
        Object.keys(this.barXType).forEach(key => {
            this.translateService.get(this.barXType[key]).subscribe((txt: string) => { this.barXType[key] = txt; });
        });
        Object.keys(this.barDateFunctionType).forEach(key => {
            this.translateService.get(this.barDateFunctionType[key]).subscribe((txt: string) => { this.barDateFunctionType[key] = txt; });
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
        this.dialogRef.close(<IDataGraphResult>{ graphs: this.data.graphs, selected: this.selectedGraph });
    }

    onAddNewCategory() {

    }

    isSelection() {
        return (this.selectedGraph && this.selectedGraph.id) ? true : false;
    }

    onEditGraph(item: Graph) {
        let title = 'dlg.item-title';
        let label = 'dlg.item-name';
        let error = 'dlg.item-name-error';
        let exist = this.data.graphs.map((g) => { if (!item || item.name !== g.name) {return g.name;} });
        this.translateService.get(title).subscribe((txt: string) => { title = txt; });
        this.translateService.get(label).subscribe((txt: string) => { label = txt; });
        this.translateService.get(error).subscribe((txt: string) => { error = txt; });
        let dialogRef = this.dialog.open(EditNameComponent, {
            position: { top: '60px' },
            data: { name: (item) ? item.name : '', title: title, label: label, exist: exist, error: error }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result && result.name && result.name.length > 0) {
                if (item) {
                    item.name = result.name;
                } else {
                    let graph = new Graph(GraphType.bar, Utils.getShortGUID(), result.name);
                    this.data.graphs.push(graph);
                    this.onSelectGraph(graph);
                }
            }
        });
    }

    onAddGraphSource(graph: Graph) {
        let dialogRef = this.dialog.open(DeviceTagSelectionComponent, {
            disableClose: true,
            position: { top: '60px' },
            data: <DeviceTagSelectionData> {
                variableId: null,
                multiSelection: false
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
                        let exist = graph.sources.find(source => source.id === tag.id);
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
        this.translateService.get('msg.graph-remove', { value: this.data.graphs[index].name }).subscribe((txt: string) => { msg = txt; });
        let dialogRef = this.dialog.open(ConfirmDialogComponent, {
            data: { msg: msg },
            position: { top: '60px' }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.data.graphs.splice(index, 1);
                this.selectedGraph = new Graph(GraphType.bar);
            }
        });
    }

    editGraphSource(source: GraphSource) {
        let dialogRef = this.dialog.open(GraphSourceEditComponent, {
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
        this.checkPropertyFunction(this.selectedGraph.property);
    }

    isGraphSelected(item: Graph) {
        if (item === this.selectedGraph) {
            return 'mychips-selected';
        }
    }

    onGraphXTypeChanged(type: GraphBarXType) {
        if (this.selectedGraph) {
            this.selectedGraph.property.xtype = type;
            this.checkPropertyFunction(this.selectedGraph.property);
        }
    }

    onGraphDateFunctionTypeChanged(type: GraphBarDateFunctionType) {
        console.log(type);
    }

    checkPropertyFunction(property: any) {
        if (property) {
            if (property.xtype === this.xTypeDate) {
                if (!property.function) {
                    property.function = new GraphBarDateFunction();
                }
                this.dateFunction = property.function;
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

interface IDataGraphConfig {
    graphs: Graph[];
    devices: Device[];
}

export interface IDataGraphResult {
    graphs: Graph[];
    selected: Graph;
}
