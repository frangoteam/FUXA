import { Component, EventEmitter, forwardRef, Input, Output, ViewEncapsulation, AfterViewInit, ElementRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import variables from './variables.json';
import { THEMES } from '../../../_config/theme.config';

type ColumnType = 'DATE' | 'TIME' | 'DATETIME';

  @Component({
    selector: 'app-ui5-datetime-picker',
    templateUrl: './ui5-datetime-picker.component.html',
	styleUrls: [],
	encapsulation: ViewEncapsulation.None,
	providers: [{
		provide: NG_VALUE_ACCESSOR,
		useExisting: forwardRef(() => Ui5DatetimePickerComponent),
		multi: true,
	}],
})
export class Ui5DatetimePickerComponent implements ControlValueAccessor, AfterViewInit {
	@Input() columnType: ColumnType = 'DATETIME';
	@Input() value: string = '';
	@Input() placeholder: string = '';
	@Input() disabled: boolean = false;

	@Output() valueChange = new EventEmitter<string>();

	private onChangeFn: (v: any) => void = () => {};
	private onTouchedFn: () => void = () => {};

	constructor(private elementRef: ElementRef) {}

	private resolveColor(group: string): string {
		return THEMES.dark[group] || group;
	}

	ngAfterViewInit() {
		const style = document.createElement('style');
		let css = ':root {\n';
		Object.keys(variables.root).forEach(key => {
			css += `  --${key}: ${this.resolveColor(variables.root[key])} !important;\n`;
		});
		css += '}';
		style.textContent = css;
		document.head.appendChild(style);
	}

	onUi5Change(event: any) {
		const newVal = event?.detail?.value ?? event?.target?.value ?? '';
		this.value = newVal ?? '';
		this.valueChange.emit(this.value);
		this.onChangeFn(this.value);
	}

	// ControlValueAccessor
	writeValue(obj: any): void {
		this.value = (obj ?? '') as string;
	}
	registerOnChange(fn: any): void {
		this.onChangeFn = fn;
	}
	registerOnTouched(fn: any): void {
		this.onTouchedFn = fn;
	}
	setDisabledState(isDisabled: boolean): void {
		this.disabled = !!isDisabled;
	}

}

