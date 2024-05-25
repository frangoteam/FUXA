import { Component, Inject, OnInit } from '@angular/core';
import { Hmi, View } from '../../_models/hmi';
import { GaugesManager } from '../../gauges/gauges.component';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ProjectService } from '../../_services/project.service';

@Component({
    selector: 'app-fuxa-view-dialog',
    templateUrl: './fuxa-view-dialog.component.html',
    styleUrls: ['./fuxa-view-dialog.component.scss']
})
export class FuxaViewDialogComponent implements OnInit {

    view: View;
    hmi: Hmi;
    gaugesManager: GaugesManager;
    variablesMapping = [];

    constructor(public dialogRef: MatDialogRef<FuxaViewDialogComponent>,
                private projectService: ProjectService,
                @Inject(MAT_DIALOG_DATA) public data: FuxaViewDialogData) {
    }

    ngOnInit() {
        this.hmi = this.projectService.getHmi();
    }

    onCloseDialog() {
        this.dialogRef.close();
    }
}

export interface FuxaViewDialogData {
    disableDefaultClose: boolean;
    bkColor: string;
    gaugesManager: GaugesManager;
    view: View;
    variablesMapping: [];
}
