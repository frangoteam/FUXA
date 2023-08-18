import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import { Tag, DevicesUtils, Device } from '../../../_models/device';
import { Utils } from '../../../_helpers/utils';
import { DeviceTagDialog } from '../../../device/device.component';
import { BitmaskComponent } from '../../../gui-helpers/bitmask/bitmask.component';
import { Observable, map, startWith } from 'rxjs';
import { UntypedFormControl } from '@angular/forms';

interface Variable {
    id: string;
    name: string;
    initValue: string;
}

export const _filter = (opt: DeviceTagOption[], value: string): DeviceTagOption[] => {
    const filterValue = value.toLowerCase();
    return opt.filter(item => item.name.toLowerCase().includes(filterValue));
};

@Component({
    selector: 'flex-variable',
    templateUrl: './flex-variable.component.html',
    styleUrls: ['./flex-variable.component.scss']
})
export class FlexVariableComponent implements OnInit {
    @Input() data: any;
    @Input() variableId: string;
    @Input() value: any;
    @Input() allowManualEdit = false;
    @Input() variableValue: string;
    @Input() variableLabel = 'gauges.property-variable-value';
    @Input() withStaticValue = true;
    @Input() withBitmask = false;
    @Input() tagLabel = 'gauges.property-tag-label';
    @Input() tagTitle = '';
    @Input() bitmask: number;
    @Input() readonly = false;

    @Output() onchange: EventEmitter<any> = new EventEmitter();
    @Output() valueChange: EventEmitter<any> = new EventEmitter();

    public manualEdit = false;

    variableList: any = [];
    selectedTag: DeviceTagOption;

    devices: DeviceGroup[] = [];
    devicesTags$: Observable<DeviceGroup[]>;
    tagFilter = new UntypedFormControl();

    constructor(public dialog: MatDialog) {
    }

    ngOnInit() {
        Object.values(this.data.devices).forEach((device: Device) => {
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
            this.devices.push(deviceGroup);
        });

        this.devicesTags$ = this.tagFilter.valueChanges.pipe(
            startWith(''),
            map(value => this._filterGroup(value || '')),
        );

        if (!this.value) {
            this.value = {
                variableId: this.variableId
            };
        } else if (this.value.variableId) {
            this.variableId = this.value.variableId;
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
          return this.devices
            .map(device => ({name: device.name, tags: _filter(device.tags, value?.name || value)}))
            .filter(device => device.tags.length > 0);
        }
        return this.devices;
    }

    private _getDeviceTag(tagId: string): DeviceTagOption  {
        for (let i = 0; i < this.devices.length; i++) {
            const tag = this.devices[i].tags.find(tag => tag.id === tagId);
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

    onDeviceTagSelected(deviceTag: DeviceTagOption) {
        this.variableId = deviceTag.id;
        this.onChanged();
    }

    getDeviceName() {
        let device = DevicesUtils.getDeviceFromTagId(this.data.devices, this.variableId);
        if (device) {
            return device.name;
        }
        return '';
    }

    getVariableName() {
        let tag = DevicesUtils.getTagFromTagId(this.data.devices, this.variableId);
        if (tag) {
            let result = tag.label || tag.name;
            if (result && tag.address && result !== tag.address) {
                return result + ' - ' + tag.address;
            }
            if (tag.address) {
                return tag.address;
            }
            return result;
        }
        return '';
    }

    getVariableMask(): string {
        if (this.bitmask) {
            return `bit ${Utils.findBitPosition(this.bitmask).toString()}`;// this.bitmask.toString(16);
        }
        return '';
    }

    onChanged() {
        let tag = DevicesUtils.getTagFromTagId(this.data.devices, this.variableId);
        if (tag) {
            this.value.variableId = tag.id;
            this.value.variableRaw = tag;
        } else {
            this.value.variableId = null;
            this.value.variableRaw = null;
        }
        if (this.withBitmask) {
            this.value.bitmask = this.bitmask;
        }
        this.value.variableValue = this.variableValue;
        this.onchange.emit(this.value);   // Legacy
        this.valueChange.emit(this.value);
    }

    onBindTag() {
        let dialogRef = this.dialog.open(DeviceTagDialog, {
            position: { top: '60px' },
            data: { variableId: this.variableId, devices: this.data.devices }
        });

        dialogRef.afterClosed().subscribe((result) => {
            if (result) {
                this.variableId = result.variableId;
                this.onChanged();
                this._setSelectedTag();
            }
        });
    }

    setVariable(tag: Tag) {
        if (tag) {
            this.variableId = tag.id;
        } else {
            this.variableId = null;
        }
        this.onChanged();
    }

    onSetBitmask() {
        let dialogRef = this.dialog.open(BitmaskComponent, {
            position: { top: '60px' },
            data: { bitmask: this.bitmask }
        });

        dialogRef.afterClosed().subscribe((result) => {
            if (result) {
                this.bitmask = result.bitmask;
                this.onChanged();
            }
        });
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
