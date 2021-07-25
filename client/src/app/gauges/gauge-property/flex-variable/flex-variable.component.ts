import { Component, EventEmitter, Input, OnInit, Output, SimpleChanges } from '@angular/core';
import { ReplaySubject, Subject } from 'rxjs';
import { FormControl } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

import { Device, DeviceType, Tag, TAG_PREFIX, DevicesUtils } from '../../../_models/device';
import { HmiService } from '../../../_services/hmi.service';
import { Utils } from '../../../_helpers/utils';
import { DeviceTagDialog } from '../../../device/device.component';

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
    @Input() allowManualEdit: boolean = false;
    @Input() variableValue: string;
    @Input() variableLabel: string = 'gauges.property-variable-value';
    @Input() withStaticValue: boolean = true;

    @Output() onchange: EventEmitter<any> = new EventEmitter();
    @Output() valueChange: EventEmitter<any> = new EventEmitter();

    public manualEdit: boolean = false;

    variableList: any = [];
    currentVariable: Variable = null;

    constructor(public dialog: MatDialog) {
    }

    ngOnInit() {
        if (!this.value) {
            this.value = {
                variableId: this.variableId
            }
        }
    }

    getDeviceName(variableId: string) {
        let device = DevicesUtils.getDeviceFromTagId(this.data.devices, this.variableId);
        if (device) {
            return device.name;
        }
        return '';
    }

    getVariableName(variableId: string) {
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

    onChanged() {
        let tag = DevicesUtils.getTagFromTagId(this.data.devices, this.variableId);
        if (tag) {
            this.value.variableId = tag.id;
            this.value.variableRaw = tag;
        } else {
            this.value.variableId = null;
            this.value.variableRaw = null;
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
            }
            this.onChanged();
        });
    }
}

