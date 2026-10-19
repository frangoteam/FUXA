import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { EthernetIPModule } from '../../_models/device';

@Component({
    selector: 'app-device-enipmodule',
    templateUrl: './device-enipmodule.component.html',
    styleUrls: ['./device-enipmodule.component.scss']
})
export class DeviceEnipmoduleComponent {
    constructor(
        public dialogRef: MatDialogRef<DeviceEnipmoduleComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { module: EthernetIPModule }) { }

    isValid(module: EthernetIPModule): boolean {
        return !!module.name?.trim() &&
            Number.isFinite(Number(module.rpi)) && Number(module.rpi) > 0 &&
            Number.isFinite(Number(module.inputInstance)) && Number(module.inputInstance) >= 0 &&
            Number.isFinite(Number(module.inputSize)) && Number(module.inputSize) >= 0 &&
            Number.isFinite(Number(module.outputInstance)) && Number(module.outputInstance) >= 0 &&
            Number.isFinite(Number(module.outputSize)) && Number(module.outputSize) >= 0 &&
            Number.isFinite(Number(module.configurationInstance)) && Number(module.configurationInstance) >= 0 &&
            Number.isFinite(Number(module.configurationSize)) && Number(module.configurationSize) >= 0 &&
            Number(module.inputSize) + Number(module.outputSize) > 0;
    }
}
