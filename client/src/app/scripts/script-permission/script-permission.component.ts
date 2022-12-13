import { Component, Inject, ViewChild } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { SelOptionsComponent } from '../../gui-helpers/sel-options/sel-options.component';
import { UserGroups } from '../../_models/user';

@Component({
  selector: 'app-script-permission',
  templateUrl: './script-permission.component.html',
  styleUrls: ['./script-permission.component.css']
})
export class ScriptPermissionComponent {

  selectedGroups = [];
	groups = UserGroups.Groups;

	@ViewChild(SelOptionsComponent, {static: false}) seloptions: SelOptionsComponent;

	constructor(public dialogRef: MatDialogRef<ScriptPermissionComponent>,
		@Inject(MAT_DIALOG_DATA) public data: any) {
		this.selectedGroups = UserGroups.ValueToGroups(this.data.permission);
	}

  	onNoClick(): void {
		this.dialogRef.close();
	}

	onOkClick(): void {
		if (this.seloptions) {
			this.data.permission = UserGroups.GroupsToValue(this.seloptions.selected);
		}
		this.dialogRef.close(this.data);
	}
}
