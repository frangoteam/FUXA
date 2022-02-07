import { Component, OnInit, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material';

import { TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-script-editor',
    templateUrl: './script-editor.component.html',
    styleUrls: ['./script-editor.component.css']
})
export class ScriptEditorComponent implements OnInit {

    content;

    constructor(public dialogRef: MatDialogRef<ScriptEditorComponent>,
        private translateService: TranslateService,
        @Inject(MAT_DIALOG_DATA) public data: any) { }

    ngOnInit() {
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        // if (this.data.editmode < 0) {
        //     this.dialogRef.close(this.notification);
        // } else if (this.checkValid()) {
        //     this.dialogRef.close(this.notification);
        // }
    }
}
