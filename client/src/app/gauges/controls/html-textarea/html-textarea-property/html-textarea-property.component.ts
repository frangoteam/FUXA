import { Component, Inject, ViewChild } from '@angular/core';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA } from '@angular/material/legacy-dialog';
import { FlexEventComponent } from '../../../gauge-property/flex-event/flex-event.component';
import { FlexActionComponent } from '../../../gauge-property/flex-action/flex-action.component';
import { FlexAuthComponent } from '../../../gauge-property/flex-auth/flex-auth.component';
import { GaugeProperty } from '../../../../_models/hmi';
import { Utils } from '../../../../_helpers/utils';

@Component({
  selector: 'html-textarea-property',
  templateUrl: './html-textarea-property.component.html',
  styleUrls: ['./html-textarea-property.component.scss']
})
export class HtmlTextareaPropertyComponent {
  @ViewChild('flexevent') flexEvent: FlexEventComponent;
  @ViewChild('flexaction') flexAction: FlexActionComponent;
  @ViewChild('flexauth', {static: false}) flexauth: FlexAuthComponent;

  property: GaugeProperty;
  name: string;
  defaultColor = Utils.defaultColor;
  eventsSupported = true;
  actionsSupported = true;

  constructor(
    public dialogRef: MatDialogRef<HtmlTextareaPropertyComponent>,
    @Inject(MAT_LEGACY_DIALOG_DATA) public data: any
  ) {
    this.property = <GaugeProperty>JSON.parse(JSON.stringify(this.data.settings.property));
    if (!this.property) {
      this.property = new GaugeProperty();
    }
    if (!this.property.options) {
      this.property.options = {};
    }
    if (!this.property.options.rows) { this.property.options.rows = 7; }
    if (!this.property.options.cols) { this.property.options.cols = 24; }
    if (!this.property.options.text) { this.property.options.text = ''; }
    this.name = this.data.settings.name;
  }

  onNoClick(): void {
    this.dialogRef.close();
  }
  onOkClick(): void {
    this.data.settings.property = this.property;
    if (this.flexauth) {
      this.data.settings.property.permission = this.flexauth.permission;
      this.data.settings.property.permissionRoles = this.flexauth.permissionRoles;
      this.data.settings.name = this.flexauth.name;
    }
    if (this.flexEvent) {
      this.data.settings.property.events = this.flexEvent.getEvents();
    }
    if (this.flexAction) {
      this.data.settings.property.actions = this.flexAction.getActions();
    }
    this.dialogRef.close(this.data);
  }

  onAddEvent(): void {
    if (this.flexEvent) {
      this.flexEvent.onAddEvent();
    }
  }

  onAddAction(): void {
    if (this.flexAction) {
      this.flexAction.onAddAction();
    }
  }

  onEditPermission(): void {
    // Logic to handle permission editing
  }

  havePermission(): boolean {
    return !!this.property.permission;
  }

  onTextChange(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.property.options.text = target.value;
  }
}
