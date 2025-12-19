import { Component, Inject, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ApiKey } from '../../_models/apikey';
import { Utils } from '../../_helpers/utils';

@Component({
    selector: 'app-api-key-property',
    templateUrl: './api-key-property.component.html',
    styleUrls: ['./api-key-property.component.scss']
})
export class ApiKeyPropertyComponent implements OnInit {

    formGroup: UntypedFormGroup;
    private original: ApiKey;

    constructor(
        public dialogRef: MatDialogRef<ApiKeyPropertyComponent>,
        private fb: UntypedFormBuilder,
        @Inject(MAT_DIALOG_DATA) data: ApiKey
    ) {
        this.original = data ? { ...data } : {} as ApiKey;
    }

    ngOnInit() {
        const created = this.original.created || new Date().toISOString();
        const expires = this.original.expires || this.defaultExpiration(created);
        this.formGroup = this.fb.group({
            id: [this.original.id || Utils.getShortGUID('ak_')],
            name: [this.original.name || '', Validators.required],
            key: [this.original.key || this.generateApiKey(), Validators.required],
            description: [this.original.description || ''],
            created: [this.toDateInputValue(created), Validators.required],
            expires: [this.toDateInputValue(expires)],
            enabled: [this.original.enabled ?? true]
        });
    }

    onCancelClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        if (this.formGroup.invalid) {
            return;
        }
        const formValue = this.formGroup.getRawValue();
        const apiKey: ApiKey = {
            ...(this.original || {} as ApiKey),
            id: formValue.id,
            name: formValue.name,
            key: formValue.key,
            description: formValue.description || '',
            created: this.toIso(formValue.created),
            expires: formValue.expires ? this.toIso(formValue.expires) : '',
            enabled: formValue.enabled
        };
        this.dialogRef.close(apiKey);
    }

    onGenerateKey(): void {
        this.formGroup.controls['key'].setValue(this.generateApiKey());
    }

    private generateApiKey(length: number = 40): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const cryptoObj = window.crypto || (window as any).msCrypto;
        if (cryptoObj?.getRandomValues) {
            const randomValues = new Uint32Array(length);
            cryptoObj.getRandomValues(randomValues);
            return Array.from(randomValues).map(val => chars[val % chars.length]).join('');
        }
        let key = '';
        for (let i = 0; i < length; i++) {
            key += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return key;
    }

    private defaultExpiration(createdIso: string): string {
        const createdDate = new Date(createdIso);
        if (isNaN(createdDate.getTime())) {
            return '';
        }
        const expiresDate = new Date(createdDate);
        expiresDate.setFullYear(expiresDate.getFullYear() + 1);
        return expiresDate.toISOString();
    }

    private toDateInputValue(value?: string): string {
        if (!value) {
            return '';
        }
        const date = new Date(value);
        if (isNaN(date.getTime())) {
            return '';
        }
        return date.toISOString().substring(0, 10);
    }

    private toIso(value: string): string {
        if (!value) {
            return '';
        }
        const date = new Date(value);
        return isNaN(date.getTime()) ? '' : date.toISOString();
    }

}
