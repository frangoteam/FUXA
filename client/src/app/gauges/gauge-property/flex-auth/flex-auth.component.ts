import { Component, Input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import { DialogGaugePermission } from '../../gauge-property/gauge-property.component';

@Component({
    selector: 'flex-auth',
    templateUrl: './flex-auth.component.html',
    styleUrls: ['./flex-auth.component.css']
})
export class FlexAuthComponent {

    @Input() name: string;
    @Input() permission: number;


    constructor(public dialog: MatDialog) { }

    onEditPermission() {
        let permission = this.permission;
        let dialogRef = this.dialog.open(DialogGaugePermission, {
            position: { top: '60px' },
            data: { permission: permission }
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
