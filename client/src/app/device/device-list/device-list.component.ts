/* eslint-disable @angular-eslint/component-class-suffix */
import { Component, OnInit, AfterViewInit, ViewChild, Input, Output, EventEmitter, Inject, ChangeDetectionStrategy } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ChangeDetectorRef } from '@angular/core';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatMenuTrigger } from '@angular/material/menu';
import { MatSort } from '@angular/material/sort';
import { SelectionModel } from '@angular/cdk/collections';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';

import { TagPropertyComponent } from './../tag-property/tag-property.component';
import { ITagOption, TagOptionsComponent } from './../tag-options/tag-options.component';
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
    styleUrls: ['./device-list.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})

export class DeviceListComponent implements OnInit, AfterViewInit {

    readonly defAllColumns = ['select', 'name', 'address', 'device', 'type', 'value', 'timestamp', 'warning', 'logger', 'options', 'remove'];
    readonly defInternalColumns = ['select', 'name', 'device', 'type', 'value', 'timestamp', 'options', 'remove'];
    readonly defAllRowWidth = 1400;
    readonly defClientRowWidth = 1400;
    readonly defInternalRowWidth = 1200;

    displayedColumns = this.defAllColumns;

    dataSource = new MatTableDataSource([]);
    selection = new SelectionModel<Element>(true, []);
    devices: Device[];
    deviceType = DeviceType;
    tableWidth = this.defAllRowWidth;
    tagsMap = {};
    deviceSelected: Device = null;
    isDeviceToEdit = true;

    @Input() readonly = false;
    @Output() save = new EventEmitter();
    @Output() goto = new EventEmitter();

    @ViewChild(MatTable, {static: false}) table: MatTable<any>;
    @ViewChild(MatSort, {static: false}) sort: MatSort;
    @ViewChild(MatMenuTrigger, {static: false}) trigger: MatMenuTrigger;
    @ViewChild(MatPaginator, {static: false}) paginator: MatPaginator;

    constructor(private dialog: MatDialog,
        private hmiService: HmiService,
        private translateService: TranslateService,
        private changeDetector: ChangeDetectorRef,
        private projectService: ProjectService,
        private toastr: ToastrService) { }

    ngOnInit() {
        this.devices = this.projectService.getDevices();
        if (!this.deviceSelected && this.devices) {
            this.deviceSelected = this.devices[0];
        }
    }

    ngAfterViewInit() {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }

    mapTags() {
        this.devices = this.projectService.getDevices();
        Object.values(this.devices).forEach(d => {
            if (d.tags) {
                Object.values(d.tags).forEach((t: Tag) => {
                    this.tagsMap[t.id] = t;
                });
            }
        });
        this.setSelectedDevice(this.deviceSelected);
    }

    private bindToTable(tags) {
        if (!tags) {
            tags = {};
        }
        this.dataSource.data = Object.values(tags);
        this.hmiService.viewsTagsSubscribe(Object.keys(tags));
    }

    onDeviceChange(source) {
        this.dataSource.data = [];
        this.deviceSelected = source.value;
        this.setSelectedDevice(this.deviceSelected);
    }

    setSelectedDevice(device: Device) {
        this.devices = this.projectService.getDevices();
        this.updateDeviceValue();
        if (!device) {
            return;
        }
        this.isDeviceToEdit = !Device.isWebApiProperty(device);
        Object.values(this.devices).forEach(d => {
            if (d.name === device.name) {
                this.deviceSelected = d;
                this.bindToTable(this.deviceSelected.tags);
            }
        });
        if (this.deviceSelected.type === DeviceType.internal) {
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
        if (this.dataSource.data[index]) {
            delete this.deviceSelected.tags[this.dataSource.data[index].id];
        }
        this.bindToTable(this.deviceSelected.tags);
        this.projectService.setDeviceTags(this.deviceSelected);
    }

    onRemoveAll() {
        let msg = '';
        this.translateService.get('msg.tags-remove-all').subscribe((txt: string) => { msg = txt; });
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

    /** Edit the tag */
    onEditRow(row) {
        if (this.deviceSelected.type === DeviceType.MQTTclient) {
            this.editTopics(row);
        } else {
            this.editTag(row, false);
        }
    }

    /** Edit tag options like DAQ settings */
    onEditOptions(row) {
        this.editTagOptions([row]);
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
                        tag.memaddress = n.parent?.id;
                    } else if (this.deviceSelected.type === DeviceType.WebAPI) {
                        tag.label = n.text;
                        if (n.class === NodeType.Reference) {
                            tag.memaddress = n.property;        // in memaddress save the address of the value
                            tag.options = n.todefine;           // save the id and value in text to set by select list
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
            return tag.label || tag.name;
        } else if (this.deviceSelected.type === DeviceType.OPCUA) {
            return tag.label;
        } else {
            return tag.name;
        }
    }

    getAddress(tag: Tag) {
        if (!tag.address) {
            return '';
        }
        if (this.deviceSelected.type === DeviceType.ModbusRTU || this.deviceSelected.type === DeviceType.ModbusTCP) {
            return parseInt(tag.address) + parseInt(tag.memaddress);
        } else if (this.deviceSelected.type === DeviceType.WebAPI) {
            if (tag.options) {
                return tag.address + ' / ' + tag.options.selval;
            }
            return tag.address;
        } else if (this.deviceSelected.type === DeviceType.MQTTclient) {
            if (tag.options && tag.options.subs && tag.type === 'json') {
                return DeviceListComponent.formatAddress(tag.address, tag.memaddress);
            }
            return tag.address;
        }
        return tag.address;
    }

    isToEdit(type, tag: Tag) {
        if (type === DeviceType.SiemensS7 || type === DeviceType.ModbusTCP || type === DeviceType.ModbusRTU ||
            type === DeviceType.internal || type === DeviceType.EthernetIP || type === DeviceType.FuxaServer) {
            return true;
        } else if (type === DeviceType.MQTTclient) {
            if (tag && tag.options && (tag.options.pubs || tag.options.subs)) {
                return true;
            }
        }
        return false;
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
                    tag.name = temptag.name;
                    tag.type = temptag.type;
                    tag.address = temptag.address;
                    tag.memaddress = temptag.memaddress;
                    tag.divisor = temptag.divisor;
                    if (this.deviceSelected.type === DeviceType.internal) {
                        tag.value = '0';
                    }
                    if (this.deviceSelected.type === DeviceType.FuxaServer) {
                        tag.init = temptag.init;
                        tag.value = temptag.init;
                    }
                    if (checkToAdd) {
                        this.checkToAdd(tag, result.device);
                    } else if (tag.id !== oldtag) {
                        //remove old tag device reference
                        delete result.device.tags[oldtag];
                        this.checkToAdd(tag, result.device);
                    }
                    this.projectService.setDeviceTags(this.deviceSelected);
                }
            }
        });
    }

    editTagOptions(tags: Tag[]) {
        let dialogRef = this.dialog.open(TagOptionsComponent, {
            data: { device: this.deviceSelected, tags: tags },
            position: { top: '60px' }
        });
        dialogRef.afterClosed().subscribe((tagOption: ITagOption) => {
            if (tagOption) {
                for (let i = 0; i < tags.length; i++) {
                    tags[i].daq = tagOption.daq;
                    tags[i].format = tagOption.format;
                    tags[i].scale = tagOption.scale;
                }
                this.projectService.setDeviceTags(this.deviceSelected);
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
        });
        if (!exist || overwrite) {
            device.tags[tag.id] = tag;
        }
        this.tagsMap[tag.id] = tag;
        this.bindToTable(this.deviceSelected.tags);
    }

    updateDeviceValue() {
        let sigs = this.hmiService.getAllSignals();
        for (let id in sigs) {
            if (this.tagsMap[id]) {
                this.tagsMap[id].value = sigs[id].value;
                this.tagsMap[id].error = sigs[id].error;
                this.tagsMap[id].timestamp = sigs[id].timestamp;
            }
        }
        this.changeDetector.detectChanges();
    }

    devicesValue(): Array<Device> {
        return Object.values(this.devices);
    }


    /**
     * to add or edit MQTT topic for subscription or publish
     */
    editTopics(topic: Tag = null) {
        if (topic && topic.options && topic.options.subs) {
            // edit only name (subscription)
            let existNames = Object.values(this.deviceSelected.tags).filter((t: Tag) => { if (t.id !== topic.id) {return t;} }).map((t: Tag) => t.name);
            let dialogRef = this.dialog.open(DialogTagName, {
                position: { top: '60px' },
                data: { name: topic.name, exist: existNames }
            });
            dialogRef.afterClosed().subscribe(result => {
                if (result) {
                    this.deviceSelected.tags[topic.id].name = result.name;
                    this.tagsMap[topic.id].name = result.name;
                    this.bindToTable(this.deviceSelected.tags);
                    this.projectService.setDeviceTags(this.deviceSelected);
                }
            });
        } else {
            // edit new topic or publish
            let dialogRef = this.dialog.open(TopicPropertyComponent, {
                panelClass: 'dialog-property',
                data: { device: this.deviceSelected, devices: Object.values(this.devices), topic: topic },
                position: { top: '60px' }
            });
            dialogRef.componentInstance.invokeSubscribe = (oldtopic, newtopics) => this.addTopicSubscription(oldtopic, newtopics);
            dialogRef.componentInstance.invokePublish = (oldtopic, newtopic) => this.addTopicToPublish(oldtopic, newtopic);
            dialogRef.afterClosed().subscribe(result => {
            });
        }
    }

    onCopyTagToClipboard(tag: Tag) {
        Utils.copyToClipboard(JSON.stringify(tag));
    }

    private addTopicSubscription(oldTopic: Tag, topics: Tag[]) {
        if (topics) {
            let existNames = Object.values(this.deviceSelected.tags).filter((t: Tag) => { if (!oldTopic || t.id !== oldTopic.id) {return t.name;} }).map((t: Tag) => t.name);
            topics.forEach((topic: Tag) => {
                // check if name exist
                if (existNames.indexOf(topic.name) !== -1) {
                    let msg = '';
                    this.translateService.get('device.topic-name-exist', { value: topic.name }).subscribe((txt: string) => { msg = txt; });
                    this.notifyError(msg);
                } else {
                    // check if subscriptions address exist for new topic
                    let exist = null;
                    if (!oldTopic) {
                        Object.keys(this.deviceSelected.tags).forEach((key) => {
                            if (this.deviceSelected.tags[key].address === topic.address && this.deviceSelected.tags[key].memaddress === topic.memaddress &&
                                this.deviceSelected.tags[key].id != topic.id && this.deviceSelected.tags[key].options.subs) {
                                exist = DeviceListComponent.formatAddress(topic.address, topic.memaddress);
                            }
                        });
                    }
                    if (exist) {
                        let msg = '';
                        this.translateService.get('device.topic-subs-address-exist', { value: exist }).subscribe((txt: string) => { msg = txt; });
                        this.notifyError(msg);
                    } else {
                        this.deviceSelected.tags[topic.id] = topic;
                        this.tagsMap[topic.id] = topic;
                    }
                }
            });
            this.bindToTable(this.deviceSelected.tags);
            this.projectService.setDeviceTags(this.deviceSelected);
        }
    }

    private addTopicToPublish(oldTopic: Tag, topic: Tag) {
        if (topic) {
            let existNames = Object.values(this.deviceSelected.tags).filter((t: Tag) => { if (!oldTopic || t.id !== oldTopic.id) {return t.name;} }).map((t: Tag) => t.name);
            // check if name exist
            if (existNames.indexOf(topic.name) !== -1) {
                let msg = '';
                this.translateService.get('device.topic-name-exist', { value: topic.name }).subscribe((txt: string) => { msg = txt; });
                this.notifyError(msg);
            } else {
                // check if publish address exist
                let exist = null;
                Object.keys(this.deviceSelected.tags).forEach((key) => {
                    if (this.deviceSelected.tags[key].address === topic.address && this.deviceSelected.tags[key].id != topic.id) {
                        exist = topic.address;
                    }
                });
                if (exist) {
                    let msg = '';
                    this.translateService.get('device.topic-pubs-address-exist', { value: exist }).subscribe((txt: string) => { msg = txt; });
                    this.notifyError(msg);
                } else {
                    this.deviceSelected.tags[topic.id] = topic;
                    this.tagsMap[topic.id] = topic;
                }
                this.bindToTable(this.deviceSelected.tags);
                this.projectService.setDeviceTags(this.deviceSelected);
            }
        }
    }

    private notifyError(error: string) {
        this.toastr.error(error, '', {
            timeOut: 3000,
            closeButton: true
            // disableTimeOut: true
        });
    }

    private static formatAddress(adr: string, mem: string): string {
        let result = adr;
        if (mem) {
            result += '[' + mem + ']';
        }
        return result;
    }
}

@Component({
    templateUrl: 'tagname.dialog.html',
})
export class DialogTagName {
    constructor(
        public dialogRef: MatDialogRef<DialogTagName>,
        @Inject(MAT_DIALOG_DATA) public data: any) { }

    onNoClick(): void {
        this.dialogRef.close();
    }

    isValid(name): boolean {
        return (this.data.exist.find((n) => n === name)) ? false : true;
    }
}

export interface Element extends Tag {
    position: number;
}
function ngAfterViewInit() {
    throw new Error('Function not implemented.');
}

