import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

// Minimal UI5 imports: components + base assets (fetch variant aligns with docs)
// Use bundled Assets instead of fetch variant so localization JSON is embedded and not fetched via file:// (prevents CLDR load errors)
import '@ui5/webcomponents-localization/dist/Assets.js'; // localization assets (required for pickers)
import '@ui5/webcomponents/dist/Assets.js'; // base + icon assets (bundled)
import '@ui5/webcomponents/dist/DatePicker.js';
import '@ui5/webcomponents/dist/TimePicker.js';
import '@ui5/webcomponents/dist/DateTimePicker.js';

import { Ui5DatetimePickerComponent } from './components/ui5-datetime/ui5-datetime-picker.component';

@NgModule({
	declarations: [Ui5DatetimePickerComponent],
	imports: [CommonModule, FormsModule, ReactiveFormsModule],
	exports: [Ui5DatetimePickerComponent],
	schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class Ui5Module {}

