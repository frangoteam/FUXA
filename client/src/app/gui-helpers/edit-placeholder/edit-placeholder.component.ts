import { Component, Inject, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';

@Component({
    selector: 'app-edit-placeholder',
    templateUrl: './edit-placeholder.component.html',
    styleUrls: ['./edit-placeholder.component.scss']
})
export class EditPlaceholderComponent implements OnInit {

    formGroup: UntypedFormGroup;

    constructor(
        public dialogRef: MatDialogRef<EditPlaceholderComponent>,
        private fb: UntypedFormBuilder,
        @Inject(MAT_DIALOG_DATA) public data: any) { }

    ngOnInit() {
        this.formGroup = this.fb.group({
            name: ['', Validators.required],
        });
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.dialogRef.close(this.formGroup.value.name);
    }
}

