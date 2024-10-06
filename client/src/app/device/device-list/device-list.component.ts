/* eslint-disable @angular-eslint/component-class-suffix */
import { Component, OnInit, AfterViewInit, ViewChild, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { ChangeDetectorRef } from '@angular/core';
import { MatLegacyTable as MatTable, MatLegacyTableDataSource as MatTableDataSource } from '@angular/material/legacy-table';
import { MatLegacyPaginator as MatPaginator } from '@angular/material/legacy-paginator';
import { MatLegacyMenuTrigger as MatMenuTrigger } from '@angular/material/legacy-menu';
import { MatSort } from '@angular/material/sort';
import { SelectionModel } from '@angular/cdk/collections';
import { TranslateService } from '@ngx-translate/core';

import { TagOptionType, TagOptionsComponent } from './../tag-options/tag-options.component';
import { Tag, Device, DeviceType, TAG_PREFIX } from '../../_models/device';
import { ProjectService } from '../../_services/project.service';
import { HmiService } from '../../_services/hmi.service';
import { ConfirmDialogComponent } from '../../gui-helpers/confirm-dialog/confirm-dialog.component';
import { Utils } from '../../_helpers/utils';
import { TagPropertyService } from '../tag-property/tag-property.service';
import { EditNameComponent } from '../../gui-helpers/edit-name/edit-name.component';

@Component({
    selector: 'app-device-list',
    templateUrl: './device-list.component.html',
    styleUrls: ['./device-list.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DeviceListComponent implements OnInit, AfterViewInit {

    readonly defAllColumns = ['select', 'name', 'address', 'device', 'type', 'value', 'timestamp', 'description', 'warning', 'logger', 'options', 'remove'];
    readonly defInternalColumns = ['select', 'name', 'device', 'type', 'value', 'timestamp', 'description', 'options', 'remove'];
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
        private tagPropertyService: TagPropertyService
        ) { }

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
            disableClose: true,
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
            this.addOpcTags();
        } else if (this.deviceSelected.type === DeviceType.MQTTclient) {
            this.editTopics();
        } else {
            let tag = new Tag(Utils.getGUID(TAG_PREFIX));
            this.editTag(tag, true);
        }
    }

    addOpcTags() {
        if (this.deviceSelected.type === DeviceType.OPCUA) {
            this.tagPropertyService.addTagsOpcUa(this.deviceSelected, this.tagsMap).subscribe(result => {
                this.bindToTable(this.deviceSelected.tags);
            });
            return;
        }
        if (this.deviceSelected.type === DeviceType.BACnet) {
            this.tagPropertyService.editTagPropertyBacnet(this.deviceSelected, this.tagsMap).subscribe(result => {
                this.bindToTable(this.deviceSelected.tags);
            });
            return;
        }
        if (this.deviceSelected.type === DeviceType.WebAPI) {
            this.tagPropertyService.editTagPropertyWebapi(this.deviceSelected, this.tagsMap).subscribe(result => {
                this.bindToTable(this.deviceSelected.tags);
            });
            return;
        }
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
                return this.tagPropertyService.formatAddress(tag.address, tag.memaddress);
            }
            return tag.address;
        }
        return tag.address;
    }

    isToEdit(type, tag: Tag) {
        if (type === DeviceType.SiemensS7 || type === DeviceType.ModbusTCP || type === DeviceType.ModbusRTU ||
            type === DeviceType.internal || type === DeviceType.EthernetIP || type === DeviceType.FuxaServer ||
            type === DeviceType.OPCUA) {
            return true;
        } else if (type === DeviceType.MQTTclient) {
            if (tag && tag.options && (tag.options.pubs || tag.options.subs)) {
                return true;
            }
        }
        return false;
    }

    editTag(tag: Tag, checkToAdd: boolean) {
        if (this.deviceSelected.type === DeviceType.SiemensS7) {
            this.tagPropertyService.editTagPropertyS7(this.deviceSelected, tag, checkToAdd).subscribe(result => {
                this.tagsMap[tag.id] = tag;
                this.bindToTable(this.deviceSelected.tags);
            });
            return;
        }
        if (this.deviceSelected.type === DeviceType.FuxaServer) {
            this.tagPropertyService.editTagPropertyServer(this.deviceSelected, tag, checkToAdd).subscribe(result => {
                this.tagsMap[tag.id] = tag;
                this.bindToTable(this.deviceSelected.tags);
            });
            return;
        }
        if (this.deviceSelected.type === DeviceType.ModbusRTU || this.deviceSelected.type === DeviceType.ModbusTCP) {
            this.tagPropertyService.editTagPropertyModbus(this.deviceSelected, tag, checkToAdd).subscribe(result => {
                this.tagsMap[tag.id] = tag;
                this.bindToTable(this.deviceSelected.tags);
            });
            return;
        }
        if (this.deviceSelected.type === DeviceType.internal) {
            this.tagPropertyService.editTagPropertyInternal(this.deviceSelected, tag, checkToAdd).subscribe(result => {
                this.tagsMap[tag.id] = tag;
                this.bindToTable(this.deviceSelected.tags);
            });
            return;
        }
        if (this.deviceSelected.type === DeviceType.EthernetIP) {
            this.tagPropertyService.editTagPropertyEthernetIp(this.deviceSelected, tag, checkToAdd).subscribe(result => {
                this.tagsMap[tag.id] = tag;
                this.bindToTable(this.deviceSelected.tags);
            });
            return;
        }
        if (this.deviceSelected.type === DeviceType.OPCUA) {
            this.tagPropertyService.editTagPropertyOpcUa(this.deviceSelected, tag, checkToAdd).subscribe(result => {
                this.tagsMap[tag.id] = tag;
                this.bindToTable(this.deviceSelected.tags);
            });
            return;
        }
    }

    editTagOptions(tags: Tag[]) {
        let dialogRef = this.dialog.open(TagOptionsComponent, {
            disableClose: true,
            data: { device: this.deviceSelected, tags: tags },
            position: { top: '60px' }
        });
        dialogRef.afterClosed().subscribe((tagOption: TagOptionType) => {
            if (tagOption) {
                for (let i = 0; i < tags.length; i++) {
                    tags[i].daq = tagOption.daq;
                    tags[i].format = tagOption.format;
                    tags[i].deadband = tagOption.deadband;
                    tags[i].scale = tagOption.scale;
                    tags[i].scaleReadFunction = tagOption.scaleReadFunction;
                    tags[i].scaleReadParams = tagOption.scaleReadParams;
                    tags[i].scaleWriteFunction = tagOption.scaleWriteFunction;
                    tags[i].scaleWriteParams = tagOption.scaleWriteParams;
                }
                this.projectService.setDeviceTags(this.deviceSelected);
            }
        });
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
            let dialogRef = this.dialog.open(EditNameComponent, {
                disableClose: true,
                position: { top: '60px' },
                data: {
                    name: topic.name,
                    exist: existNames,
                    error: this.translateService.instant('msg.device-tag-exist')
                }
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
            this.tagPropertyService.editTagPropertyMqtt(
                this.deviceSelected,
                topic,
                this.tagsMap,
                () => {
                    this.bindToTable(this.deviceSelected.tags);
                }
            );
        }
    }

    onCopyTagToClipboard(tag: Tag) {
        Utils.copyToClipboard(JSON.stringify(tag));
    }
}

export interface Element extends Tag {
    position: number;
}


