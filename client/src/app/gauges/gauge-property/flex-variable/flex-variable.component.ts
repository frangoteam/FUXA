import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import { Tag, DevicesUtils } from '../../../_models/device';
import { Utils } from '../../../_helpers/utils';
import { DeviceTagDialog } from '../../../device/device.component';
import { BitmaskComponent } from '../../../gui-helpers/bitmask/bitmask.component';

interface Variable {
    id: string;
    name: string;
    initValue: string;
}

@Component({
    selector: 'flex-variable',
    templateUrl: './flex-variable.component.html',
    styleUrls: ['./flex-variable.component.css']
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

    @Output() onchange: EventEmitter<any> = new EventEmitter();
    @Output() valueChange: EventEmitter<any> = new EventEmitter();

    public manualEdit = false;

    variableList: any = [];
    currentVariable: Variable = null;

    constructor(public dialog: MatDialog) {
    }

    ngOnInit() {
        if (!this.value) {
            this.value = {
                variableId: this.variableId
            };
        } else if (this.value.variableId) {
            this.variableId = this.value.variableId;
        }
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

