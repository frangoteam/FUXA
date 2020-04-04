import { Component, OnInit, Input } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

import { GaugeProperty } from '../../../_models/hmi';
import { DialogGaugePermission } from '../../gauge-property/gauge-property.component';

@Component({
    selector: 'flex-auth',
    templateUrl: './flex-auth.component.html',
    styleUrls: ['./flex-auth.component.css']
})
export class FlexAuthComponent implements OnInit {

    @Input() name: string;
    @Input() permission: number;


    constructor(public dialog: MatDialog) { }

    ngOnInit() {
        // this.property = JSON.parse(JSON.stringify(this.data.settings.property));
    }

    onEditPermission() {
        let permission = this.permission;
        let dialogRef = this.dialog.open(DialogGaugePermission, {
            minWidth: '350px',
            data: { permission: permission },
            position: { top: '90px' }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.permission = result.permission;
            }
        });
    }

    getResult() {
        return { name: this.name, pemission: this.permission };
    }
}
