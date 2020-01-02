import { Component, OnInit, ViewChild, Input, Output, EventEmitter } from '@angular/core';
import { MatTable, MatTableDataSource, MatSort, MatMenuTrigger } from '@angular/material';
import { SelectionModel } from '@angular/cdk/collections';
import { MatDialog } from '@angular/material';

import { TagPropertyComponent } from './../tag-property/tag-property.component';
import { Tag, Device, DeviceType } from '../../_models/device';
import { ProjectService } from '../../_services/project.service';
import { HmiService } from '../../_services/hmi.service';
import { Node } from '../../gui-helpers/treetable/treetable.component';
import { Utils } from '../../_helpers/utils';

@Component({
    selector: 'app-device-list',
    templateUrl: './device-list.component.html',
    styleUrls: ['./device-list.component.css']
})

export class DeviceListComponent implements OnInit {


    displayedColumns = ['select', 'name', 'address', 'device', 'type', 'min', 'max', 'value', 'remove'];
    dataSource = new MatTableDataSource([]);
    selection = new SelectionModel<Element>(true, []);
    devices: Device[];
    dirty: boolean = false;
    deviceType = DeviceType;

    @Input() deviceSelected: Device;
    @Output() save = new EventEmitter();
    @Output() goto = new EventEmitter();

    @ViewChild(MatTable) table: MatTable<any>;
    @ViewChild(MatSort) sort: MatSort;
    @ViewChild(MatMenuTrigger) trigger: MatMenuTrigger;

    constructor(private dialog: MatDialog,
        private hmiService: HmiService,
        private projectService: ProjectService) { }

    ngOnInit() {
        this.devices = this.projectService.getDevices();
        if (!this.deviceSelected && this.devices) {
            this.deviceSelected = this.devices[0];
        }
    }

    ngAfterViewInit() {
        if (this.deviceSelected) {
            this.bindToTable(this.deviceSelected.tags);
        }
        this.dataSource.sort = this.sort;
        this.table.renderRows();
    }

    private bindToTable(tags) {
        this.dataSource.data = Object.values(tags);
    }

    onDeviceChange(source) {
        this.dataSource.data = [];
        this.deviceSelected = source.value;
        if (this.deviceSelected.tags) {
            this.bindToTable(this.deviceSelected.tags);
        }
    }

    setSelectedDevice(device: Device) {
        this.devices = this.projectService.getDevices();//JSON.parse(JSON.stringify(this.projectService.getDevices()));
        this.updateDeviceValue();
        // this.devices = JSON.parse(JSON.stringify(this.projectService.getDevices()));
        Object.values(this.devices).forEach(d => {
            if (d.name === device.name) {
                this.deviceSelected = d;
                this.bindToTable(this.deviceSelected.tags);
            }
        });
    }

    onGoBack() {
        this.goto.emit();
    }

    onRemoveRow(row) {
        const index = this.dataSource.data.indexOf(row, 0);
        // if (index > -1) {
        //   this.dataSource.data.splice(index, 1);
        //   this.dirty = true;
        // }
        if (this.dataSource.data[index]) {
            delete this.deviceSelected.tags[this.dataSource.data[index].id];
        }
        this.bindToTable(this.deviceSelected.tags);
        this.projectService.setDeviceTags(this.deviceSelected);
    }

    /** Whether the number of selected elements matches the total number of rows. */
    isAllSelected() {
        const numSelected = this.selection.selected.length;
        const numRows = this.dataSource.data.length;
        return numSelected === numRows;
    }

    /** Selects all rows if they are not all selected; otherwise clear selection. */
    masterToggle() {
        this.isAllSelected() ?
            this.selection.clear() :
            this.dataSource.data.forEach(row => this.selection.select(row));
    }

    applyFilter(filterValue: string) {
        filterValue = filterValue.trim(); // Remove whitespace
        filterValue = filterValue.toLowerCase(); // MatTableDataSource defaults to lowercase matches
        this.dataSource.filter = filterValue;
    }

    onEditRow(row) {
        this.editTag(row, false);
    }

    onAddTag() {
        if (this.deviceSelected.type === DeviceType.OPCUA) {
            this.addOpcTags(null);
        } else {
            let tag = new Tag();
            this.editTag(tag, true);
        }
    }

    addOpcTags(tag: Tag) {
        // console.log('The Edit Tag open');
        let dialogRef = this.dialog.open(TagPropertyComponent, {
            minWidth: '1200px',
            minHeight: '900px',
            panelClass: 'dialog-property',
            data: { device: this.deviceSelected, tag: tag, devices: this.devices },
            position: { top: '80px' }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.dirty = true;
                result.nodes.forEach((n: Node) => {
                    let tag: Tag = new Tag();
                    tag.id = n.id;
                    tag.name = n.id;
                    tag.type = n.type;
                    tag.address = n.id;
                    this.checkToAdd(tag, result.device);
                });
                this.projectService.setDeviceTags(this.deviceSelected);
            }
        });
    }

    editTag(tag: Tag, checkToAdd: boolean) {
        // console.log('The Edit Tag open');
        let oldtag = tag.name;
        let temptag = JSON.parse(JSON.stringify(tag));
        let dialogRef = this.dialog.open(TagPropertyComponent, {
            // minWidth: '700px',
            // minHeight: '700px',
            panelClass: 'dialog-property',
            data: { device: this.deviceSelected, tag: temptag, devices: this.devices },
            position: { top: '80px' }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.dirty = true;
                // console.log('The Edit Tag was closed');
                // tag.id = (tag.id) ? tag.id : Utils.getShortGUID();
                tag.id = temptag.name;
                tag.name = temptag.name;
                tag.type = temptag.type;
                tag.address = temptag.address;
                tag.min = temptag.min;
                tag.max = temptag.max;
                if (checkToAdd) {
                    this.checkToAdd(tag, result.device);
                } else if (tag.id !== oldtag) {
                    //remove old tag device reference
                    delete result.device.tags[oldtag];
                    this.checkToAdd(tag, result.device);
                }
                this.projectService.setDeviceTags(this.deviceSelected);
            }
        });
    }

    checkToAdd(tag: Tag, device: Device) {
        let exist = false;
        Object.keys(device.tags).forEach((key) => {
            if (device.tags[key].id) {
                if (device.tags[key].id === tag.id) {
                    exist = true;
                }
            } else if (device.tags[key].name === tag.id) {
                exist = true;
            }
        })
        if (!exist) {
            device.tags[tag.id] = tag;
        }
        this.bindToTable(this.deviceSelected.tags);
    }

    updateDeviceValue() {
        let sigs = this.hmiService.getAllSignals();
        for (let id in sigs) {
            let vartoken = id.split(HmiService.separator);
            if (vartoken.length > 1 && this.devices[vartoken[0]] && this.devices[vartoken[0]].tags[vartoken[1]]) {
                this.devices[vartoken[0]].tags[vartoken[1]].value = sigs[id].value;
            }
        }
    }

    devicesValue(): Array<Device> {
        return Object.values(this.devices);
    }
}

export interface Element extends Tag {
    position: number;
}
