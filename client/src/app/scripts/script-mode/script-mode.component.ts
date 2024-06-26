import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ScriptMode } from '../../_models/script';
import { AbstractControl, UntypedFormBuilder, UntypedFormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { ProjectService } from '../../_services/project.service';

@Component({
	selector: 'app-script-mode',
	templateUrl: './script-mode.component.html',
	styleUrls: ['./script-mode.component.css']
})
export class ScriptModeComponent implements OnInit {

    formGroup: UntypedFormGroup;

	scriptMode = ScriptMode;
    existingNames = [];

	constructor(public dialogRef: MatDialogRef<ScriptModeComponent>,
        		private translateService: TranslateService,
        		private projectService: ProjectService,
				private fb: UntypedFormBuilder,
				@Inject(MAT_DIALOG_DATA) public data: ScriptModeType) {
	}

	ngOnInit() {
        this.existingNames = this.projectService.getScripts()?.map(script => script.name);

        this.formGroup = this.fb.group({
            name: [this.data.name],
            mode: [this.data.mode, Validators.required],
        });
		if (this.data.newScript) {
			this.formGroup.controls.name.setValidators([Validators.required, this.isValidScriptName()]);
		}
    }

	onNoClick(): void {
		this.dialogRef.close();
	}

	onOkClick(): void {
		this.dialogRef.close(this.formGroup.getRawValue());
	}

	isValidScriptName(): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            if (this.existingNames.indexOf(control.value) !== -1) {
                return { name: this.translateService.instant('msg.script-name-exist') };
            }
            return null;
        };
    }
}

export interface ScriptModeType {
	name: string;
	mode: ScriptMode;
	newScript?: boolean;
}
