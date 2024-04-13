import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Observable, map, startWith } from 'rxjs';
import { ProjectService } from '../../../_services/project.service';
import { Device, DevicesUtils, PlaceholderDevice, Tag } from '../../../_models/device';
import { DeviceTagSelectionComponent, DeviceTagSelectionData } from '../../../device/device-tag-selection/device-tag-selection.component';
import { Utils } from '../../../_helpers/utils';

export const _filter = (opt: DeviceTagOption[], value: string): DeviceTagOption[] => {
    const filterValue = value.toLowerCase();
    return opt.filter(item => item.name.toLowerCase().includes(filterValue));
};

@Component({
    selector: 'app-flex-device-tag',
    templateUrl: './flex-device-tag.component.html',
    styleUrls: ['./flex-device-tag.component.scss']
})
export class FlexDeviceTagComponent implements OnInit {

    @Input() tagTitle = '';
    @Input() readonly = false;
    @Input() variableId: string;

    @Output() change: EventEmitter<string> = new EventEmitter();

    devicesGroups: DeviceGroup[] = [];
    devicesTags$: Observable<DeviceGroup[]>;
    tagFilter = new UntypedFormControl();
    devices: Device[] = [];

    constructor(private projectService: ProjectService,
                public dialog: MatDialog) {
    }

    ngOnInit() {
        this.devicesGroups.push(Utils.clone(PlaceholderDevice));
        this.devices = Object.values(this.projectService.getDevices());
        this.devices.forEach((device: Device) => {
            let deviceGroup = <DeviceGroup> {
                name: device.name,
                tags: [],
            };
            Object.values(device.tags).forEach((tag: Tag) => {
                const deviceTag = <DeviceTagOption> {
                    id: tag.id,
                    name: this._tagToVariableName(tag),
                    device: device.name
                };
                deviceGroup.tags.push(deviceTag);
            });
            this.devicesGroups.push(deviceGroup);
        });

        this.devicesTags$ = this.tagFilter.valueChanges.pipe(
            startWith(''),
            map(value => this._filterGroup(value || '')),
        );
        if (this.variableId?.startsWith(PlaceholderDevice.id)) {
            this.devicesGroups[0].tags.push({
                id: this.variableId,
                name: this.variableId,
                device: '@'
            });
        }
        this._setSelectedTag();
    }

    private _tagToVariableName(tag: Tag) {
        let result = tag.label || tag.name;
        if (result && tag.address && result !== tag.address) {
            result = result + ' - ' + tag.address;
        }
        return result;
    }

    private _filterGroup(value: any): DeviceGroup[] {
        if (value) {
          return this.devicesGroups
            .map(device => ({name: device.name, tags: _filter(device.tags, value?.name || value)}))
            .filter(device => device.tags.length > 0);
        }
        return this.devicesGroups;
    }

    private _getDeviceTag(tagId: string): DeviceTagOption  {
        for (let i = 0; i < this.devicesGroups.length; i++) {
            const tag = this.devicesGroups[i].tags.find(tag => tag.id === tagId);
            if (tag) {
                return tag;
            }
        }
        return null;
    }

    private _setSelectedTag() {
        const tag = this._getDeviceTag(this.variableId);
        this.tagFilter.patchValue(tag);
    }

    displayFn(deviceTag: DeviceTagOption): string {
        return deviceTag?.name;
    }

    getDeviceName() {
        const device = DevicesUtils.getDeviceFromTagId(this.devices, this.variableId);
        if (device) {
            return device.name;
        }
        return '';
    }

    onDeviceTagSelected(deviceTag: DeviceTagOption) {
        this.variableId = deviceTag.id;
        this.onChanged();
    }

    onBindTag() {
        let dialogRef = this.dialog.open(DeviceTagSelectionComponent, {
            disableClose: true,
            position: { top: '60px' },
            data: <DeviceTagSelectionData> {
                variableId: this.variableId
            }
        });

        dialogRef.afterClosed().subscribe((result) => {
            if (result) {
                this.variableId = result.variableId;
                this._setSelectedTag();
                this.onChanged();
            }
        });
    }

    onChanged() {
        this.change.emit(this.variableId);   // Legacy
    }
}


interface DeviceGroup {
    name: string;
    tags: DeviceTagOption[];
}

interface DeviceTagOption {
    id: string;
    name: string;
    device: string;
}
