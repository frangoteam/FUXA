import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ScriptMode } from '../../_models/script';

@Component({
	selector: 'app-script-mode',
	templateUrl: './script-mode.component.html',
	styleUrls: ['./script-mode.component.css']
})
export class ScriptModeComponent {

	scriptMode = ScriptMode;

	constructor(public dialogRef: MatDialogRef<ScriptModeComponent>,
		@Inject(MAT_DIALOG_DATA) public data: any) {
	}

	onNoClick(): void {
		this.dialogRef.close();
	}

	onOkClick(): void {
		this.dialogRef.close(this.data);
	}
}
