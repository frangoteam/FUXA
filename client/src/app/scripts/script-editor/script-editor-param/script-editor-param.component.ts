import { Component, Inject } from '@angular/core';
import { ScriptParamType } from '../../../_models/script';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { Utils } from '../../../_helpers/utils';

@Component({
    selector: 'app-script-editor-param',
    templateUrl: './script-editor-param.component.html',
    styleUrls: ['./script-editor-param.component.css']
})
export class ScriptEditorParamComponent {
    error = '';
    existError: string;
    paramType = Utils.enumKeys(ScriptParamType);

    constructor(public dialogRef: MatDialogRef<ScriptEditorParamComponent>,
        private translateService: TranslateService,
        @Inject(MAT_DIALOG_DATA) public data: any) {

        this.existError = this.translateService.instant('script.param-name-exist');
    }

    onNoClick(): void {
        this.dialogRef.close();

    }

    isValid(name): boolean {
        if (this.data.validator && !this.data.validator(name)) { return false; }
        if (!this.data.type) { return false; }
        if (!this.data.name) { return false; }
        return (this.data.exist.find((n) => n === name)) ? false : true;
    }

    onCheckValue(input: any) {
        if (this.data.exist && this.data.exist.length && input.target.value) {
            if (this.data.exist.find((n) => n === input.target.value)) {
                this.error = this.existError;
                return;
            }
        }
        this.error = '';
    }
}
