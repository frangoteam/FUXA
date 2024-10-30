/* eslint-disable @angular-eslint/component-class-suffix */
import {Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {Subscription} from 'rxjs';
import {Router} from '@angular/router';

import {DeviceListComponent} from './device-list/device-list.component';
import {DeviceMapComponent} from './device-map/device-map.component';
import {Device, DEVICE_PREFIX, DevicesUtils, DeviceType, DeviceViewModeType, TAG_PREFIX} from './../_models/device';
import {ProjectService} from '../_services/project.service';
import {HmiService} from '../_services/hmi.service';
import {DEVICE_READONLY} from '../_models/hmi';
import {Utils} from '../_helpers/utils';

@Component({
    selector: 'app-device',
    templateUrl: './device.component.html',
    styleUrls: ['./device.component.css']
})
export class DeviceComponent implements OnInit, OnDestroy {

    @ViewChild('devicelist', {static: false}) deviceList: DeviceListComponent;
    @ViewChild('devicemap', {static: false}) deviceMap: DeviceMapComponent;
    @ViewChild('fileImportInput', {static: false}) fileImportInput: any;
    @ViewChild('tplFileImportInput',{static: false}) tplFileImportInput: any;

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

    onImportTpl() {
        let ele = document.getElementById('devicesConfigTplUpload') as HTMLElement;
        ele.click();
    }

    /**
     * @deprecated use onDevTplChangeListener
     * open Project event file loaded
     * @param event file resource
     */
    onFileChangeListener(event) {
        return this.onDevTplChangeListener(event,false);
    }

    /**
     * open Project event file loaded
     * @param event file resource
     * @param isTemplate use template for import, if true,generate new device id and tag id
     */
    onDevTplChangeListener(event,isTemplate: boolean){
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
            //generate new id and filte fuxa
            let importDev = [];
            if(isTemplate){
                devices.forEach((device: Device) => {
                    if (device.type != DeviceType.FuxaServer) {
                        device.id = Utils.getGUID(DEVICE_PREFIX);
                        device.name = Utils.getShortGUID(device.name + '_', '');
                        if (device.tags) {
                            Object.keys(device.tags).forEach((key) => {
                                device.tags[key].id = Utils.getGUID(TAG_PREFIX);
                            });
                        }
                        importDev.push(device);
                    }
                });
            }
            this.projectService.importDevices(isTemplate? importDev: devices);
            setTimeout(() => { this.projectService.onRefreshProject(); }, 2000);
        };

        reader.onerror = function() {
            let msg = 'Unable to read ' + input.files[0];
            // this.translateService.get('msg.project-load-error', {value: input.files[0]}).subscribe((txt: string) => { msg = txt });
            alert(msg);
        };
        reader.readAsText(input.files[0]);
        this.tplFileImportInput.nativeElement.value = null;
    }
}
