/* eslint-disable @angular-eslint/component-class-suffix */
import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { UntypedFormControl } from '@angular/forms';
import { Router } from '@angular/router';

import { DeviceListComponent } from './device-list/device-list.component';
import { DeviceMapComponent } from './device-map/device-map.component';
import { Device, Tag, DeviceViewModeType, DevicesUtils } from './../_models/device';
import { ProjectService } from '../_services/project.service';
import { HmiService } from '../_services/hmi.service';
import { DEVICE_READONLY } from '../_models/hmi';
import { Utils } from '../_helpers/utils';

@Component({
    selector: 'app-device',
    templateUrl: './device.component.html',
    styleUrls: ['./device.component.css']
})
export class DeviceComponent implements OnInit, OnDestroy {

    @ViewChild('devicelist', {static: false}) deviceList: DeviceListComponent;
    @ViewChild('devicemap', {static: false}) deviceMap: DeviceMapComponent;
    @ViewChild('fileImportInput', {static: false}) fileImportInput: any;

    private subscriptionLoad: Subscription;
    private subscriptionDeviceChange: Subscription;
    private subscriptionVariableChange: Subscription;
    private askStatusTimer;

    devicesViewMode = DeviceViewModeType.devices;
    devicesViewMap = DeviceViewModeType.map;
    devicesViewList = DeviceViewModeType.list;
    tagsViewMode = DeviceViewModeType.tags;

    showMode = <string>this.devicesViewMap;
    readonly = false;
    reloadActive = false;

    constructor(private router: Router,
        private projectService: ProjectService,
        private hmiService: HmiService) {
        if (this.router.url.indexOf(DEVICE_READONLY) >= 0) {
            this.readonly = true;
        }
        this.showMode = localStorage.getItem('@frango.devicesview') || this.devicesViewMap;
    }

    ngOnInit() {
        this.subscriptionLoad = this.projectService.onLoadHmi.subscribe(res => {
            this.deviceMap.loadCurrentProject();
            this.deviceList.mapTags();
        });
        this.subscriptionDeviceChange = this.hmiService.onDeviceChanged.subscribe(event => {
            this.deviceMap.setDeviceStatus(event);
        });
        this.subscriptionVariableChange = this.hmiService.onVariableChanged.subscribe(event => {
            this.deviceList.updateDeviceValue();
        });
        this.askStatusTimer = setInterval(() => {
            this.hmiService.askDeviceStatus();
        }, 10000);
        this.hmiService.askDeviceStatus();
    }

    ngOnDestroy() {
        // this.checkToSave();
        try {
            if (this.subscriptionLoad) {
                this.subscriptionLoad.unsubscribe();
            }
            if (this.subscriptionDeviceChange) {
                this.subscriptionDeviceChange.unsubscribe();
            }
            if (this.subscriptionVariableChange) {
                this.subscriptionVariableChange.unsubscribe();
            }
        } catch (e) {
        }
        try {
            clearInterval(this.askStatusTimer);
            this.askStatusTimer = null;
        } catch { }
    }

    show(mode: string) {
        // this.checkToSave();
        this.showMode = mode;
        if (this.showMode === this.tagsViewMode) {
            this.deviceList.updateDeviceValue();
            try {
                if (Object.values(this.deviceMap.devicesValue()).length > 0) {
                    this.deviceList.setSelectedDevice(this.deviceMap.devicesValue()[0]);
                }
            } catch (e) {
            }
        } else {
            localStorage.setItem('@frango.devicesview', this.showMode);
        }
    }

    gotoDevices(flag: boolean) {
        if (flag) {
            if (this.showMode === this.devicesViewMap) {
                this.show(this.devicesViewList);
            } else {
                this.show(this.devicesViewMap);
            }
            return;
        }
        let mode = localStorage.getItem('@frango.devicesview') || this.devicesViewMap;
        this.show(mode);
    }

    gotoList(device: Device) {
        this.onReload();
        this.show(this.tagsViewMode);
        this.deviceList.setSelectedDevice(device);
    }

    addItem() {
        if (this.showMode === this.tagsViewMode) {
            this.deviceList.onAddTag();
        } else if (this.showMode.startsWith(this.devicesViewMode)) {
            this.deviceMap.addDevice();
        }
    }

    onReload() {
        this.projectService.onRefreshProject();
        this.reloadActive = true;
        setTimeout(() => {
            this.reloadActive = false;
        }, 1000);
    }

    onExport(type: string) {
        try {
            this.projectService.exportDevices(type);
        } catch (err) {
            console.error(err);
        }
    }

    onImport() {
        let ele = document.getElementById('devicesConfigFileUpload') as HTMLElement;
        ele.click();
    }

    /**
     * open Project event file loaded
     * @param event file resource
     */
    onFileChangeListener(event) {
        let input = event.target;
        let reader = new FileReader();
        reader.onload = (data) => {
            let devices;
            if (Utils.isJson(reader.result)) {
                // JSON
                devices = JSON.parse(reader.result.toString());
            } else {
                // CSV
                devices = DevicesUtils.csvToDevices(reader.result.toString());
            }
            this.projectService.importDevices(devices);
            setTimeout(() => { this.projectService.onRefreshProject(); }, 2000);
        };

        reader.onerror = function() {
            let msg = 'Unable to read ' + input.files[0];
            // this.translateService.get('msg.project-load-error', {value: input.files[0]}).subscribe((txt: string) => { msg = txt });
            alert(msg);
        };
        reader.readAsText(input.files[0]);
        this.fileImportInput.nativeElement.value = null;
    }
}

@Component({
    selector: 'device-tag-dialog',
    templateUrl: './device-tag.dialog.html',
    styleUrls: ['./device.component.css']
})
export class DeviceTagDialog implements OnInit, AfterViewInit {

    @ViewChild(MatTable, {static: false}) table: MatTable<any>;
    @ViewChild(MatSort, {static: false}) sort: MatSort;
    @ViewChild(MatPaginator, {static: false}) paginator: MatPaginator;

    dataSource = new MatTableDataSource([]);
    nameFilter = new UntypedFormControl();
    addressFilter = new UntypedFormControl();
    deviceFilter = new UntypedFormControl();
    tags: TagElement[] = [];

    filteredValues = {
        name: '', address: '', device: ''
    };

    readonly defColumns = ['toogle', 'name', 'address', 'device', 'select'];

    constructor(public dialogRef: MatDialogRef<DeviceTagDialog>,
        @Inject(MAT_DIALOG_DATA) public data: any) {
        if (this.data.devices) {
            this.data.devices.forEach((device: Device) => {
                if (data.deviceFilter && data.deviceFilter.indexOf(device.type) !== -1) {
                    // filtered device
                } else if (device.tags) {
                    Object.values(device.tags).forEach((t: Tag) => this.tags.push(<TagElement> {
                            id: t.id, name: t.name, address: t.address,
                            device: device.name, checked: (t.id === this.data.variableId), error: null
                        }
                    ));
                }
            }
            );
        }
        this.dataSource = new MatTableDataSource(this.tags);
    }

    ngOnInit() {

        this.nameFilter.valueChanges.subscribe((nameFilterValue) => {
            this.filteredValues['name'] = nameFilterValue;
            this.dataSource.filter = JSON.stringify(this.filteredValues);
        });

        this.addressFilter.valueChanges.subscribe((addressFilterValue) => {
            this.filteredValues['address'] = addressFilterValue;
            this.dataSource.filter = JSON.stringify(this.filteredValues);
        });

        this.deviceFilter.valueChanges.subscribe((deviceFilterValue) => {
            this.filteredValues['device'] = deviceFilterValue;
            this.dataSource.filter = JSON.stringify(this.filteredValues);
        });
        this.dataSource.filterPredicate = this.customFilterPredicate();
    }

    customFilterPredicate() {
        const myFilterPredicate = (data: TagElement, filter: string): boolean => {
            let searchString = JSON.parse(filter);
            return (!data.name || data.name.toString().trim().toLowerCase().indexOf(searchString.name.toLowerCase()) !== -1) &&
                (!data.address || data.address.toString().trim().toLowerCase().indexOf(searchString.address.toLowerCase()) !== -1) &&
                data.device.toString().trim().toLowerCase().indexOf(searchString.device.toLowerCase()) !== -1;
        };
        return myFilterPredicate;
    }

    ngAfterViewInit() {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
        // this.dataSource.data = this.data.tags;
    }

    onToogle(element: TagElement) {
        if (element.checked && !this.data.multiSelection) {
            this.dataSource.data.forEach(e => {
                if (e.id !== element.id) {
                    e.checked = false;
                }
            });
        }
    }

    onClearSelection() {
        this.dataSource.data.forEach(e => {
            e.checked = false;
        });
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.data.variableId = null;
        this.data.variablesId = [];
        this.dataSource.data.forEach(e => {
            if (e.checked) {
                this.data.variableId = e.id;
                this.data.variablesId.push(e.id);
            }
        });
        this.dialogRef.close(this.data);
    }

    onSelect(element: TagElement) {
        this.data.variableId = element.id;
        this.dialogRef.close(this.data);
    }
}

export interface TagElement {
    id: string;
    name: string;
    address: string;
    device: string;
    checked: boolean;
    error: string;
}
