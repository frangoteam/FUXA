import { Component, EventEmitter, Inject, OnInit, Output } from '@angular/core';
import { Device, Tag } from '../../../_models/device';
import { MAT_DIALOG_DATA as MAT_DIALOG_DATA, MatDialogRef as MatDialogRef } from '@angular/material/dialog';

@Component({
    selector: 'app-tag-property-edit-iothttp',
    templateUrl: './tag-property-edit-iothttp.component.html',
    styleUrls: ['./tag-property-edit-iothttp.component.css']
})
export class TagPropertyEditIothttpComponent implements OnInit {

    @Output() result = new EventEmitter<any>();

    tagName = '';
    tagType = 'number';
    tagAddress = '';
    memaddress = '';
    readMethod = 'GET';
    tagDescription = '';

    writeMethod = 'none';
    writePath = '';
    writeKey = '';
    writeMode = 'json-key';
    writeContentType = 'application/json';
    writeTemplate = '';

    readMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    writeMethods = ['none', 'POST', 'PUT', 'PATCH', 'DELETE'];
    bodyModes = ['json-key', 'json-template', 'raw', 'form'];

    testing = false;
    testResult: { ok: boolean; value?: any; status?: number; error?: string; raw?: string } = null;

    async testRead() {
        this.testing = true;
        this.testResult = null;
        try {
            const token = (window as any).fuxaAccessToken || '';
            const res = await fetch('/api/iothttp/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-access-token': token },
                body: JSON.stringify({
                    property: this.data.device.property,
                    tag: { address: this.tagAddress, memaddress: this.memaddress, readMethod: this.readMethod },
                }),
            });
            const json = await res.json();
            let raw = '';
            try { raw = JSON.stringify(json.data); } catch (_e) { raw = String(json.data); }
            if (raw && raw.length > 800) { raw = raw.slice(0, 800) + '…'; }
            this.testResult = {
                ok: !!json.ok,
                value: json.value,
                status: json.status,
                error: json.error,
                raw,
            };
        } catch (e) {
            this.testResult = { ok: false, error: (e as Error).message };
        } finally {
            this.testing = false;
        }
    }

    constructor(
        public dialogRef: MatDialogRef<TagPropertyEditIothttpComponent>,
        @Inject(MAT_DIALOG_DATA) public data: TagPropertyIotHttpData) { }

    ngOnInit() {
        const tag = this.data.tag || {} as Tag;
        this.tagName = tag.name || '';
        this.tagType = tag.type || 'number';
        this.tagAddress = tag.address || '';
        this.memaddress = tag.memaddress || '';
        this.tagDescription = tag.description || '';
        const opt = this.parseOptions(tag.options);
        if (opt.readMethod) {
            this.readMethod = String(opt.readMethod).toUpperCase();
        }
        const write = opt.write || {};
        if (write.method) {
            this.writeMethod = String(write.method).toUpperCase();
            this.writePath = write.path || '';
            this.writeKey = write.key || '';
            this.writeMode = write.mode || 'json-key';
            this.writeContentType = write.contentType || 'application/json';
            this.writeTemplate = write.template || '';
        }
    }

    private parseOptions(options: any): any {
        if (!options) return {};
        if (typeof options === 'object') return options;
        try { return JSON.parse(options); } catch (_e) { return {}; }
    }

    onOkClick() {
        const options: any = {};
        if (this.readMethod && this.readMethod !== 'GET') {
            options.readMethod = this.readMethod;
        }
        if (this.writeMethod && this.writeMethod !== 'none') {
            options.write = {
                method: this.writeMethod,
                path: this.writePath || this.tagAddress,
                key: this.writeKey || this.tagName,
                mode: this.writeMode || 'json-key',
                contentType: this.writeContentType || 'application/json',
                template: this.writeTemplate || undefined,
            };
        }
        this.result.emit({
            tagName: this.tagName,
            tagType: this.tagType,
            tagAddress: this.tagAddress,
            memaddress: this.memaddress,
            tagDescription: this.tagDescription,
            options,
        });
    }

    onNoClick() {
        this.dialogRef.close();
    }
}

export interface TagPropertyIotHttpData {
    device: Device;
    tag: Tag;
}
