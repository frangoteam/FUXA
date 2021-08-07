import { Component, OnInit, ViewChild, Input, Output, EventEmitter } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
import { MatTable, MatTableDataSource, MatSort, MatMenuTrigger } from '@angular/material';
import { SelectionModel } from '@angular/cdk/collections';
import { MatDialog } from '@angular/material';
import { TranslateService } from '@ngx-translate/core';

import { TagPropertyComponent } from './../tag-property/tag-property.component';
import { TopicPropertyComponent } from './../topic-property/topic-property.component';
import { Tag, Device, DeviceType, TAG_PREFIX } from '../../_models/device';
import { ProjectService } from '../../_services/project.service';
import { HmiService } from '../../_services/hmi.service';
import { Node, NodeType } from '../../gui-helpers/treetable/treetable.component';
import { ConfirmDialogComponent } from '../../gui-helpers/confirm-dialog/confirm-dialog.component';
import { Utils } from '../../_helpers/utils';

@Component({
    selector: 'app-device-list',
    templateUrl: './device-list.component.html',
    styleUrls: ['./device-list.component.css']
})

export class DeviceListComponent implements OnInit {

    readonly defAllColumns = ['select', 'name', 'address', 'device', 'type', 'value', 'warning', 'remove'];
    readonly defClientColumns = ['select', 'name', 'address', 'device', 'type', 'value', 'warning', 'remove'];
    readonly defInternalColumns = ['select', 'name', 'device', 'type', 'value', 'remove'];
    readonly defAllRowWidth = 1400;
    readonly defClientRowWidth = 1400;
    readonly defInternalRowWidth = 1200;

    displayedColumns = this.defAllColumns;

    dataSource = new MatTableDataSource([]);
    selection = new SelectionModel<Element>(true, []);
    devices: Device[];
    dirty: boolean = false;
    deviceType = DeviceType;
    tableWidth = this.defAllRowWidth;
    tagsMap = {};

    @Input() deviceSelected: Device;
    @Output() save = new EventEmitter();
    @Output() goto = new EventEmitter();

    @ViewChild(MatTable) table: MatTable<any>;
    @ViewChild(MatSort) sort: MatSort;
    @ViewChild(MatMenuTrigger) trigger: MatMenuTrigger;

    constructor(private dialog: MatDialog,
        private hmiService: HmiService,
        private translateService: TranslateService,
        private changeDetector: ChangeDetectorRef,
        private projectService: ProjectService) { }

    ngOnInit() {
    }

    ngAfterViewInit() {
        this.devices = this.projectService.getDevices();
        if (!this.deviceSelected && this.devices) {
            this.deviceSelected = this.devices[0];
        }
        Object.values(this.devices).forEach(d => {
            Object.values(d.tags).forEach((t: Tag) => {
                this.tagsMap[t.id] = t;
            })
        });

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
        this.setSelectedDevice(this.deviceSelected);
    }

    setSelectedDevice(device: Device) {
        this.devices = this.projectService.getDevices();
        this.updateDeviceValue();
        // this.devices = JSON.parse(JSON.stringify(this.projectService.getDevices()));
        Object.values(this.devices).forEach(d => {
            if (d.name === device.name) {
                this.deviceSelected = d;
                this.bindToTable(this.deviceSelected.tags);
            }
        });
        if (this.deviceSelected.type === DeviceType.WebStudio) {
            this.displayedColumns = this.defClientColumns;
            this.tableWidth = this.defClientRowWidth;
        } else if (this.deviceSelected.type === DeviceType.internal) {
            this.displayedColumns = this.defInternalColumns;
            this.tableWidth = this.defInternalRowWidth;
        } else {
            this.displayedColumns = this.defAllColumns;
            this.tableWidth = this.defAllRowWidth;
        }

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

    onRemoveAll() {
        let msg = '';
        this.translateService.get('msg.tags-remove-all').subscribe((txt: string) => { msg = txt });
        let dialogRef = this.dialog.open(ConfirmDialogComponent, {
            data: { msg: msg },
            position: { top: '60px' }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.clearTags();
            }
        });
    }

    private clearTags() {
        this.deviceSelected.tags = {};
        this.bindToTable(this.deviceSelected.tags);
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
        if (this.deviceSelected.type === DeviceType.MQTTclient) {
            this.editTopics(row);
        } else {
            this.editTag(row, false);
        }
    }

    onAddTag() {
        if (this.deviceSelected.type === DeviceType.OPCUA || this.deviceSelected.type === DeviceType.BACnet || this.deviceSelected.type === DeviceType.WebAPI) {
            this.addOpcTags(null);
        } else if (this.deviceSelected.type === DeviceType.MQTTclient) {
            this.editTopics();
        } else {
            let tag = new Tag(Utils.getGUID(TAG_PREFIX));
            this.editTag(tag, true);
        }
    }

    addOpcTags(tag: Tag) {
        let dialogRef = this.dialog.open(TagPropertyComponent, {
            panelClass: 'dialog-property',
            data: { device: this.deviceSelected, tag: tag, devices: this.devices },
            position: { top: '60px' }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.dirty = true;
                if (this.deviceSelected.type === DeviceType.WebAPI) {
                    // this.clearTags();
                }
                result.nodes.forEach((n: Node) => {
                    let tag = new Tag(Utils.getGUID(TAG_PREFIX));
                    tag.name = n.text;
                    tag.label = n.text;
                    tag.type = n.type;
                    if (this.deviceSelected.type === DeviceType.BACnet) {
                        tag.label = n.text;
                    } else if (this.deviceSelected.type === DeviceType.WebAPI) {
                        tag.label = n.text;
                        if (n.class === NodeType.Reference) {
                            tag.memaddress = n.property;    // in memaddress save the address of the value
                            tag.options = n.todefine;         // save the id and value in text to set by select list
                            tag.type = n.type;
                        }
                    }
                    tag.address = n.id;
                    this.checkToAdd(tag, result.device);
                });
                this.projectService.setDeviceTags(this.deviceSelected);
            }
        });
    }

    getTagLabel(tag: Tag) {
        if (this.deviceSelected.type === DeviceType.BACnet || this.deviceSelected.type === DeviceType.WebAPI) {
            return tag.label;
        } else if (this.deviceSelected.type === DeviceType.OPCUA) {
            return tag.label;
        } else {
            return tag.name;
        }
    }

    getAddress(tag: Tag) {
        if (this.deviceSelected.type === DeviceType.ModbusRTU || this.deviceSelected.type === DeviceType.ModbusTCP) {
            return  parseInt(tag.address) + parseInt(tag.memaddress);
        } else if (this.deviceSelected.type === DeviceType.WebAPI) {
            if (tag.options) {
                return tag.address + ' / ' + tag.options.selval;
            }
            return tag.address;
        }
        return tag.address;
    }

    isToEdit(type) {
        return (type === DeviceType.SiemensS7 || type === DeviceType.ModbusTCP || type === DeviceType.ModbusRTU || type === DeviceType.WebStudio ||
                type === DeviceType.internal || type === DeviceType.MQTTclient);
    }

    editTag(tag: Tag, checkToAdd: boolean) {
        let oldtag = tag.id;
        let temptag: Tag = JSON.parse(JSON.stringify(tag));
        let dialogRef = this.dialog.open(TagPropertyComponent, {
            panelClass: 'dialog-property',
            data: { device: this.deviceSelected, tag: temptag, devices: this.devices },
            position: { top: '60px' }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                if (this.deviceSelected.type === DeviceType.MQTTclient) {
                    result.nodes.forEach((ta: Tag) => {
                        this.checkToAdd(tag, result.device);
                    });
                    this.projectService.setDeviceTags(this.deviceSelected);
                } else {
                    this.dirty = true;
                    tag.name = temptag.name;
                    tag.type = temptag.type;
                    tag.address = temptag.address;
                    tag.memaddress = temptag.memaddress;
                    tag.divisor = temptag.divisor;
                    if (this.deviceSelected.type === DeviceType.internal) {
                        tag.value = '0';
                    }
                    if (checkToAdd) {
                        this.checkToAdd(tag, result.device);
                    } else if (tag.id !== oldtag) {
                        //remove old tag device reference
                        delete result.device.tags[oldtag];
                        this.checkToAdd(tag, result.device);
                    }
                    if (result.unit) {
                        let utag = new Tag(Utils.getGUID(TAG_PREFIX));
                        utag.address = result.unit;
                        this.checkToAddAddress(utag, result.device);
                    }
                    if (result.digits) {
                        let dtag = new Tag(Utils.getGUID(TAG_PREFIX));
                        dtag.address = result.digits;
                        this.checkToAddAddress(dtag, result.device);
                    }
                    this.projectService.setDeviceTags(this.deviceSelected);
                }
            }
        });
    }

    checkToAdd(tag: Tag, device: Device, overwrite: boolean = false) {
        let exist = false;
        Object.keys(device.tags).forEach((key) => {
            if (device.tags[key].id) {
                if (device.tags[key].id === tag.id) {
                    exist = true;
                }
            } else if (device.tags[key].name === tag.name) {
                exist = true;
            }
        })
        if (!exist || overwrite) {
            device.tags[tag.id] = tag;
        }
        this.tagsMap[tag.id] = tag;
        this.bindToTable(this.deviceSelected.tags);
    }

    checkToAddAddress(tag: Tag, device: Device) {
        let exist = false;
        Object.keys(device.tags).forEach((key) => {
            if (device.tags[key].address === tag.address && device.tags[key].id != tag.id) {
                exist = true;
            }
        })
        if (!exist) {
            device.tags[tag.id] = tag;
            this.tagsMap[tag.id] = tag;
        }
        this.bindToTable(this.deviceSelected.tags);
    }

    updateDeviceValue() {
        let sigs = this.hmiService.getAllSignals();
        for (let id in sigs) {
            if (this.tagsMap[id]) {
                this.tagsMap[id].value = sigs[id].value;
                this.tagsMap[id].error = sigs[id].error;
            }
        }
        this.changeDetector.detectChanges();
    }

    devicesValue(): Array<Device> {
        return Object.values(this.devices);
    }

        
    /**
     * to add MQTT topic for subscription or publish
     */
     editTopics(topic: Tag = null) {
        let dialogRef = this.dialog.open(TopicPropertyComponent, {
            panelClass: 'dialog-property',
            data: { device: this.deviceSelected, devices: Object.values(this.devices), topic: topic },
            position: { top: '60px' }
        });
        dialogRef.componentInstance.invokeSubscribe = (topics) => this.addTopicSubscription(topics);
        dialogRef.componentInstance.invokePuplish = (newtopic) => this.addTopicToPublish(newtopic);
        dialogRef.afterClosed().subscribe(result => {
        });
    }

    private addTopicSubscription(topics: Tag[]) {
        if (topics) {
            topics.forEach((topic: Tag) => {
                this.checkToAddAddress(topic, this.deviceSelected);
            });
            this.projectService.setDeviceTags(this.deviceSelected);
        }
    }

    private addTopicToPublish(topic: Tag) {
        if (topic) {
            this.checkToAddAddress(topic, this.deviceSelected);
            this.projectService.setDeviceTags(this.deviceSelected);
        }
    }

}

export interface Element extends Tag {
    position: number;
}
