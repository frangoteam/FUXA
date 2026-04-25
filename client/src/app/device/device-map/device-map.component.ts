import { Component, OnInit, OnDestroy, AfterViewInit, Output, EventEmitter, ElementRef, Input, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatDialog as MatDialog } from '@angular/material/dialog';
import { MatTable as MatTable, MatTableDataSource as MatTableDataSource } from '@angular/material/table';
import { MatPaginator as MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { TranslateService } from '@ngx-translate/core';

import { DevicePropertyComponent } from './../device-property/device-property.component';
import { ProjectService } from '../../_services/project.service';
import { PluginService } from '../../_services/plugin.service';
import { Device, DeviceType, DeviceNetProperty, DEVICE_PREFIX, DeviceViewModeType, DeviceConnectionStatusType } from './../../_models/device';
import { Utils } from '../../_helpers/utils';
import { AppService } from '../../_services/app.service';
import { DeviceWebapiPropertyDialogComponent } from './device-webapi-property-dialog/device-webapi-property-dialog.component';

@Component({
    selector: 'app-device-map',
    templateUrl: './device-map.component.html',
    styleUrls: ['./device-map.component.scss']
})
export class DeviceMapComponent implements OnInit, OnDestroy, AfterViewInit {

    @Output() goto: EventEmitter<Device> = new EventEmitter();
    @Input() mode: string;
    @Input() readonly = false;
    private subscriptionPluginsChange: Subscription;

    devicesViewMap = DeviceViewModeType.map;
    devicesViewList = DeviceViewModeType.list;
    deviceStatusType = DeviceConnectionStatusType;

    displayedColumns = ['select', 'name', 'type', 'polling', 'address', 'status', 'enabled', 'remove'];
    dataSource = new MatTableDataSource([]);
    tableWidth = 1200;

    @ViewChild(MatTable, {static: false}) table: MatTable<any>;
    @ViewChild(MatSort, {static: false}) sort: MatSort;
    @ViewChild(MatPaginator, {static: false}) paginator: MatPaginator;

    cardGap = 40;
    laneSidePadding = 64;

    flowBorder = 5;
    flowWidth = 220;
    flowHeight = 92;
    flowLineHeight = 100;

    deviceBorder = 5;
    deviceWidth = 220;
    deviceHeight = 110;
    deviceLineHeight = 60;

    lineFlowSize = 6;
    lineFlowHeight = 70;
    lineDeviceSize = 6;
    mainDeviceLineHeight = 120;
    mainWidth = 220;
    mainHeight = 110;
    mainBorder = 5;

    server: Device;
    devices = {};
    plugins = [];

    devicesStatus = {};
    dirty = false;
    domArea: any;

    constructor(private dialog: MatDialog,
        private translateService: TranslateService,
        private elementRef: ElementRef,
        private appService: AppService,
        private pluginService: PluginService,
        private projectService: ProjectService) {
        this.domArea = this.elementRef.nativeElement.parent;
    }

    ngOnInit() {
        this.loadCurrentProject();
        this.loadAvailableType();
        this.subscriptionPluginsChange = this.pluginService.onPluginsChanged.subscribe(event => {
            this.loadAvailableType();
        });
        Object.keys(this.deviceStatusType).forEach(key => {
            this.translateService.get(this.deviceStatusType[key]).subscribe((txt: string) => { this.deviceStatusType[key] = txt; });
        });
    }

    ngAfterViewInit() {
        if (this.appService.isClientApp) {
            this.mainDeviceLineHeight = 0;
            this.mainHeight = 0;
            this.flowLineHeight = 0;
            this.flowHeight = 0;
            this.lineFlowHeight = 0;
        }

        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }

    ngOnDestroy() {
        try {
            if (this.subscriptionPluginsChange) {
                this.subscriptionPluginsChange.unsubscribe();
            }
        } catch (e) {
        }
    }

    onEditDevice(device: Device) {
        if (Device.isWebApiProperty(device)) {
            this.showDeviceWebApiProperty(device);
        } else {
            this.editDevice(device, false);
        }
    }

    loadCurrentProject() {
        // take the copy of devices to save by leave
        let prj = this.projectService.getProject();
        this.devices = this.projectService.getDevices();
        if (prj && prj.server) {
            this.server = this.devices[prj.server.id];
        }
        this.loadDevices();
    }

    loadDevices() {
        this.devices = this.projectService.checkSystemTags();
        this.dataSource.data = Object.values(this.devices);
    }

    loadAvailableType() {
        // define available device type (plugins)
        this.plugins = [];
        if (!this.appService.isClientApp && !this.appService.isDemoApp) {
            this.pluginService.getPlugins().subscribe(plugins => {
                Object.values(plugins).forEach((pg) => {
                    if (pg.current.length) {
                        this.plugins.push(pg.type);
                    }
                });
            }, error => {
            });
            this.plugins.push(DeviceType.WebAPI);
            this.plugins.push(DeviceType.MQTTclient);
            this.plugins.push(DeviceType.internal);
        } else {
            this.plugins.push(DeviceType.internal);
        }
    }

    addDevice() {
        let device = new Device(Utils.getGUID(DEVICE_PREFIX));
        device.property = new DeviceNetProperty();
        device.enabled = false;
        device.tags = {};
        this.editDevice(device, false);
    }

    onRemoveDevice(device: Device) {
        this.editDevice(device, true);
    }

    removeDevice(device: Device) {
        delete this.devices[device.id];
        this.loadDevices();
    }

    private getWindowWidth() {
        let result = window.innerWidth;
        if (this.appService.isClientApp && this.elementRef.nativeElement && this.elementRef.nativeElement.parentElement) {
            result = this.elementRef.nativeElement.parentElement.clientWidth;
        }
        if (this.devices) {
            result = Math.max(result, this.getLaneRequiredWidth(this.plcs().length, this.deviceWidth), this.getLaneRequiredWidth(this.flows().length, this.flowWidth));
        }
        return result;
    }

    private getLaneRequiredWidth(count: number, cardWidth: number) {
        if (!count) {
            return cardWidth + this.laneSidePadding * 2;
        }
        return count * cardWidth + Math.max(0, count - 1) * this.cardGap + this.laneSidePadding * 2;
    }

    private getLaneStart(count: number, cardWidth: number) {
        const laneWidth = this.getLaneRequiredWidth(count, cardWidth);
        return Math.max(this.laneSidePadding, (this.getWindowWidth() - laneWidth) / 2 + this.laneSidePadding);
    }

    private getLaneLeftPosition(index: number, count: number, cardWidth: number) {
        return this.getLaneStart(count, cardWidth) + index * (cardWidth + this.cardGap);
    }

    private getLaneCenterX(index: number, count: number, cardWidth: number, borderWidth: number, lineSize: number) {
        return this.getLaneLeftPosition(index, count, cardWidth) + borderWidth + cardWidth / 2 - lineSize / 2;
    }

    private getHorizontalCenter() {
        return this.getWindowWidth() / 2;
    }

    private getVerticalCenter() {
        if (this.devices && this.plcs().length && this.flows().length) {
            return window.innerHeight / 5 * 2;
        } else if (this.flows().length) {
            return window.innerHeight / 2;
        } else {
            return window.innerHeight / 3;
        }
    }

    getMainLeftPosition() {
        return this.getHorizontalCenter() - this.mainWidth / 2;
    }

    getMainTopPosition() {
        return this.getVerticalCenter() - this.mainHeight / 2;
    }

    getMainLineLeftPosition() {
        return this.getHorizontalCenter() - 1 + this.lineDeviceSize / 2;
    }

    getMainLineTopPosition(type = null) {
        if (type === 'flow') {
            return this.getVerticalCenter() + this.mainBorder - (this.lineFlowHeight + this.mainHeight / 2);
        }
        return this.getVerticalCenter() + this.mainBorder + this.mainHeight / 2;
    }

    getMainLineHeight(type = null) {
        if (this.devices) {
            if (type === 'flow') {
                if (this.flows().length) {
                    return this.lineFlowHeight;
                }
            } else {
                if (this.plcs().length) {
                    return this.mainDeviceLineHeight;
                }
            }
        }
        return 0;
    }

    getDeviceLeftPosition(index: number, type = null) {
        if (this.devices) {
            if (type === 'flow') {
                if (this.flows().length) {
                    return this.getLaneLeftPosition(index, this.flows().length, this.flowWidth);
                }
            } else {
                if (this.plcs().length) {
                    return this.getLaneLeftPosition(index, this.plcs().length, this.deviceWidth);
                }
            }
        }
        return 0;
    }

    getDeviceTopPosition(type = null) {
        if (!this.server) {
            let pos = this.elementRef.nativeElement.parentElement.clientHeight / 2;
            if (pos < 200) {
                pos = 200;
            }
            if (type === 'flow') {
                pos -= (this.mainHeight * 2);
            } else {
                pos += (this.mainHeight / 2);
            }
            return pos;
        } else if (type === 'flow') {
            return this.getDeviceLineTopPosition(type) - (this.flowHeight + this.flowBorder * 2);
        } else {
            return this.getVerticalCenter() + (this.mainHeight / 2 + this.deviceLineHeight + this.mainDeviceLineHeight);
        }
    }

    getDeviceLineLeftPosition(index: number, type = null) {
        if (this.devices) {
            if (type === 'flow') {
                if (this.flows().length) {
                    return this.getLaneCenterX(index, this.flows().length, this.flowWidth, this.flowBorder, this.lineDeviceSize);
                }
            } else {
                if (this.plcs().length) {
                    return this.getLaneCenterX(index, this.plcs().length, this.deviceWidth, this.deviceBorder, this.lineDeviceSize);
                }
            }
        }
        return 0;
    }

    getDeviceLineTopPosition(type = null) {
        if (type === 'flow') {
            return this.getDeviceConnectionTopPosition(type) + this.lineFlowSize - this.flowLineHeight;
        } else {
            return this.getDeviceTopPosition(type) - this.deviceLineHeight;
        }
    }

    getDeviceConnectionLeftPosition(type = null) {
        if (type === 'flow') {
            return this.getLaneCenterX(0, this.flows().length, this.flowWidth, this.flowBorder, this.lineFlowSize);
        } else {
            return this.getLaneCenterX(0, this.plcs().length, this.deviceWidth, this.deviceBorder, this.lineDeviceSize);
        }
    }

    getDeviceConnectionTopPosition(type = null) {
        if (type === 'flow') {
            return this.getMainLineTopPosition(type) - this.lineFlowSize;
        } else {
            return this.getDeviceLineTopPosition();
        }
    }

    getDeviceConnectionWidth(type = null) {
        if (this.devices) {
            if (type === 'flow') {
                let count = this.flows().length;
                if (count) {
                    if (count === 1) {
                        return 0;
                    }
                    return this.getLaneCenterX(count - 1, count, this.flowWidth, this.flowBorder, this.lineFlowSize)
                        - this.getLaneCenterX(0, count, this.flowWidth, this.flowBorder, this.lineFlowSize);
                }
            } else {
                let count = this.plcs().length;
                if (count) {
                    if (count === 1) {
                        return 0;
                    }
                    return this.getLaneCenterX(count - 1, count, this.deviceWidth, this.deviceBorder, this.lineDeviceSize)
                        - this.getLaneCenterX(0, count, this.deviceWidth, this.deviceBorder, this.lineDeviceSize);
                }
            }
        }
        return 0;
    }

    devicesValue(type = null): Array<Device> {
        if (this.devices) {
            if (type === 'flow') {
                if (this.flows().length) {
                    let result: Device[] = this.flows();
                    return result.sort((a, b) => (a.name > b.name) ? 1 : -1);
                }
            } else {
                if (this.plcs().length) {
                    let result: Device[] = this.plcs();
                    return result.sort((a, b) => (a.name > b.name) ? 1 : -1);
                }
            }
        }
        return [];
    }

    onListDevice(device: Device) {
        this.goto.emit(device);
    }

    withListConfig(device: Device): boolean {
        return device.type !== DeviceType.ODBC;
    }

    isDevicePropertyToShow(device: Device) {
        if (device.property && device.type !== 'OPCUA') {
            return true;
        }
    }

    isClientDevice(device: Device) {
        return (this.appService.isClientApp);
    }

    isServer(device: Device) {
        return this.server.id === device.id;
    }

    getDeviceAddress(device: Device) {
        if (device.property) {
            return device.property.address;
        }
        return '';
    }

    getDevicePropertyToShow(device: Device) {
        let result = '';
        if (device.property) {
            if (device.type === DeviceType.OPCUA) {
                result = 'OPC-UA';
            } else if (device.type === DeviceType.SiemensS7) {
                result = 'Port: ';
                if (device.property.port) {
                    result += device.property.port;
                }
                result += ' / Rack: ';
                if (device.property.rack) {
                    result += device.property.rack;
                }
                result += ' / Slot: ';
                if (device.property.slot) {
                    result += device.property.slot;
                }
            } else if (device.type === DeviceType.ModbusTCP) {
                result = 'Modbus-TCP  ' + 'Slave ID: ';
                if (device.property.slaveid) {
                    result += device.property.slaveid;
                }
            } else if (device.type === DeviceType.ModbusRTU) {
                result = 'Modbus-RTU  ' + 'Slave ID: ';
                if (device.property.slaveid) {
                    result += device.property.slaveid;
                }
            }
        }
        return result;
    }

    getDeviceIcon(device: Device) {
        if (!device) {
            return 'devices';
        }
        switch (device.type) {
            case DeviceType.FuxaServer:
                return 'hub';
            case DeviceType.WebAPI:
                return 'api';
            case DeviceType.ODBC:
                return 'storage';
            case DeviceType.OPCUA:
                return 'account_tree';
            case DeviceType.MQTTclient:
                return 'rss_feed';
            case DeviceType.internal:
                return 'memory';
            case DeviceType.WebCam:
                return 'videocam';
            case DeviceType.GPIO:
                return 'settings_input_component';
            default:
                return 'developer_board';
        }
    }

    getDeviceAccentClass(device: Device) {
        if (!device) {
            return 'accent-device';
        }
        if (device.type === DeviceType.FuxaServer) {
            return 'accent-server';
        }
        if (device.type === DeviceType.internal) {
            return 'accent-internal';
        }
        if (device.type === DeviceType.WebAPI || device.type === DeviceType.ODBC) {
            return 'accent-flow';
        }
        return 'accent-device';
    }

    getDeviceStatusColor(device: Device) {
        if (this.devicesStatus[device.id]) {
            let milli = new Date().getTime();
            if (this.devicesStatus[device.id].last + 15000 < milli) {
                if (this.devicesStatus[device.id].status !== 'connect-off') {
                    this.devicesStatus[device.id].status = 'connect-error';
                    this.devicesStatus[device.id].last = new Date().getTime();
                }
            }
            let st = this.devicesStatus[device.id].status;
            if (st === 'connect-ok') {
                return '#00b050';
            } else if (st === 'connect-error' || st === 'connect-failed') {
                return '#ff2d2d';
            } else if (st === 'connect-off' || st === 'connect-busy') {
                return '#ffc000';
            }
        }
    }

    getDeviceStatusText(device: Device) {
        if (this.devicesStatus[device.id]) {
            let st = this.devicesStatus[device.id]?.status?.replace('connect-', '');
            if (this.deviceStatusType[st]) {
                return this.deviceStatusType[st];
            }
        }
        return '-';
    }

    getNodeClass(device: Device) {
        if (device.type === DeviceType.internal) {
            return 'node-internal';
        }
        return 'node-device';
    }

    setDeviceStatus(event) {
        this.devicesStatus[event.id] = { status: event.status, last: new Date().getTime() };
    }

    editDevice(device: Device, toremove: boolean) {
        let exist = Object.values(this.devices).filter((d: Device) => d.id !== device.id).map((d: Device) => d.name);
        exist.push('server');
        let tempdevice = JSON.parse(JSON.stringify(device));
        let dialogRef = this.dialog.open(DevicePropertyComponent, {
            disableClose: true,
            panelClass: 'dialog-property',
            data: {
                device: tempdevice, remove: toremove, exist: exist, availableType: this.plugins,
                projectService: this.projectService
            },
            position: { top: '60px' }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.dirty = true;
                if (toremove) {
                    this.removeDevice(device);
                    this.projectService.removeDevice(device);
                } else {
                    let olddevice = JSON.parse(JSON.stringify(device));
                    device.name = tempdevice.name;
                    device.type = tempdevice.type;
                    device.enabled = tempdevice.enabled;
                    device.polling = tempdevice.polling;
                    if (this.appService.isClientApp || this.appService.isDemoApp) {
                        delete device.property;
                    }
                    if (device.property && tempdevice.property) {
                        device.property.address = tempdevice.property.address;
                        device.property.port = parseInt(tempdevice.property.port);
                        device.property.slot = parseInt(tempdevice.property.slot);
                        device.property.rack = parseInt(tempdevice.property.rack);
                        device.property.slaveid = tempdevice.property.slaveid;
                        device.property.baudrate = tempdevice.property.baudrate;
                        device.property.databits = tempdevice.property.databits;
                        device.property.stopbits = tempdevice.property.stopbits;
                        device.property.parity = tempdevice.property.parity;
                        device.property.options = tempdevice.property.options;
                        device.property.delay = tempdevice.property.delay;
                        device.property.method = tempdevice.property.method;
                        device.property.format = tempdevice.property.format;
                        device.property.broadcastAddress = tempdevice.property.broadcastAddress;
                        device.property.adpuTimeout = tempdevice.property.adpuTimeout;
                        device.property.local = tempdevice.property.local;
                        device.property.router = tempdevice.property.router;
                        if (device.type === DeviceType.MELSEC) {
                            device.property.ascii = tempdevice.property.ascii;
                            device.property.octalIO = tempdevice.property.octalIO;
                        }
                        if (tempdevice.property.connectionOption) {
                            device.property.connectionOption = tempdevice.property.connectionOption;
                        }
                        device.property.socketReuse = tempdevice.property.socketReuse;
                        device.property.forceFC16 = tempdevice.property.forceFC16;
                    }
                    this.projectService.setDevice(device, olddevice, result.security);
                }
                this.loadDevices();
            }
        });
    }

    showDeviceWebApiProperty(device: Device) {
        let dialogRef = this.dialog.open(DeviceWebapiPropertyDialogComponent, {
            data: {
                device: device,
            },
            position: { top: '60px' }
        });

        dialogRef.afterClosed().subscribe(() => {
        });
    }

    plcs(): Device[] {
        return <Device[]>Object.values(this.devices).filter((d: Device) => d.type !== DeviceType.WebAPI
            && d.type !== DeviceType.FuxaServer
            && d.type !== DeviceType.ODBC
            && d.type !== DeviceType.internal);
    }

    flows(): Device[] {
        return <Device[]>Object.values(this.devices).filter((d: Device) => d.type === DeviceType.WebAPI
            || d.type === DeviceType.ODBC
            || d.type === DeviceType.internal);
    }
}
