import { Component, Inject, ViewChild } from '@angular/core';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';
import { SelOptionsComponent } from '../../../gui-helpers/sel-options/sel-options.component';
import { Observable, map, of } from 'rxjs';
import { Define } from '../../../_helpers/define';
import { UserGroups } from '../../../_models/user';
import { LinkType } from '../../../_models/hmi';
import { ProjectService } from '../../../_services/project.service';
import { UploadFile } from '../../../_models/project';

@Component({
    selector: 'app-layout-menu-item-property',
    templateUrl: './layout-menu-item-property.component.html',
    styleUrls: ['./layout-menu-item-property.component.css']
})
export class LayoutMenuItemPropertyComponent {
    selectedGroups = [];
    groups = UserGroups.Groups;
    icons$: Observable<string[]>;
    linkAddress = LinkType.address;
    linkAlarms = LinkType.alarms;

    @ViewChild(SelOptionsComponent, { static: false }) seloptions: SelOptionsComponent;

    constructor(public projectService: ProjectService,
        public dialogRef: MatDialogRef<LayoutMenuItemPropertyComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any) {
        this.selectedGroups = UserGroups.ValueToGroups(this.data.permission);

        this.icons$ = of(Define.MaterialIconsRegular).pipe(
            map((data: string) => data.split('\n')),
            map(lines => lines.map(line => line.split(' ')[0])),
            map(names => names.filter(name => !!name))
        );
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.data.permission = UserGroups.GroupsToValue(this.seloptions.selected);
        this.dialogRef.close(this.data);
    }

    /**
     * add image to view
     * @param event selected file
     */
    onSetImage(event) {
        if (event.target.files) {
            let filename = event.target.files[0].name;
            let fileToUpload = { type: filename.split('.').pop().toLowerCase(), name: filename.split('/').pop(), data: null };
            let reader = new FileReader();
            reader.onload = () => {
                try {
                    fileToUpload.data = reader.result;
                    this.projectService.uploadFile(fileToUpload).subscribe((result: UploadFile) => {
                        this.data.item.image = result.location;
                        this.data.item.icon = null;
                    });
                } catch (err) {
                    console.error(err);
                }
            };
            if (fileToUpload.type === 'svg') {
                reader.readAsText(event.target.files[0]);
            } else {
                reader.readAsDataURL(event.target.files[0]);
            }
        }
    }
}
