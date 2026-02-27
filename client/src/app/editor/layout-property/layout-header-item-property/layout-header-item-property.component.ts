import { Component, Inject } from '@angular/core';
import { MatDialogRef as MatDialogRef, MAT_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/dialog';
import { HeaderItem, HeaderItemType } from '../../../_models/hmi';
import { ProjectService } from '../../../_services/project.service';
import { Utils } from '../../../_helpers/utils';

@Component({
    selector: 'app-layout-header-item-property',
    templateUrl: './layout-header-item-property.component.html',
    styleUrls: ['./layout-header-item-property.component.scss']
})
export class LayoutHeaderItemPropertyComponent {
    item: HeaderItem;
    headerType = <HeaderItemType[]>['button', 'label', 'image'];
    defaultColor = Utils.defaultColor;

    constructor(
        public projectService: ProjectService,
        public dialogRef: MatDialogRef<LayoutHeaderItemPropertyComponent>,
        @Inject(MAT_DIALOG_DATA) public data: HeaderItem) {

        this.item = data;
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.dialogRef.close(this.item);
    }
}
