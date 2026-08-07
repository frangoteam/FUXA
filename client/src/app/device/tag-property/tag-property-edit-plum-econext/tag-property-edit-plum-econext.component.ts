import { Component, Inject, OnDestroy, OnInit, ViewChild, Output, EventEmitter } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, takeUntil } from 'rxjs';
import { Device, Tag, TagType } from '../../../_models/device';
import { AbstractControl, UntypedFormBuilder, UntypedFormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { HmiService } from '../../../_services/hmi.service';
import { Node, NodeType, TreetableComponent } from '../../../gui-helpers/treetable/treetable.component';

/** Browser dedicated to parameters discovered by PLUM ecoNEXT Gateway. */
@Component({
    selector: 'app-tag-property-edit-plum-econext',
    templateUrl: './tag-property-edit-plum-econext.component.html',
    styleUrls: ['./tag-property-edit-plum-econext.component.scss']
})
export class TagPropertyEditPlumEconetComponent implements OnInit, OnDestroy {
    @Output() result = new EventEmitter<TagPropertyPlumEconextData>();
    @ViewChild(TreetableComponent, { static: false }) treetable: TreetableComponent;

    private destroy$ = new Subject<void>();
    // Roughly 30% smaller than the original 1000x640 browser and constrained
    // to the viewport so the dialog remains usable on smaller screens.
    config = { height: 'min(400px, 45vh)', width: '100%' };
    currentValue: any = null;
    manualValue: any = null;
    writeMessage = '';
    writeLog: Array<{ time: string; success: boolean; message: string; details?: any }> = [];
    writeLogVisible = false;
    searchText = '';
    sortDirection: 'asc' | 'desc' = 'asc';
    formGroup: UntypedFormGroup;
    tagType = TagType;
    existingNames: string[] = [];

    constructor(
        private hmiService: HmiService,
        private fb: UntypedFormBuilder,
        private translateService: TranslateService,
        public dialogRef: MatDialogRef<TagPropertyEditPlumEconetComponent>,
        @Inject(MAT_DIALOG_DATA) public data: TagPropertyPlumEconextData
    ) { }

    ngOnInit() {
        if (this.data.tag) {
            this.existingNames = Object.values(this.data.device.tags || {})
                .filter((tag: Tag) => tag.id !== this.data.tag.id)
                .map((tag: Tag) => tag.name);
            this.formGroup = this.fb.group({
                deviceName: [this.data.device.name, Validators.required],
                gatewayName: [this.data.tag.options?.gatewayName || this.data.tag.name],
                tagName: [this.data.tag.name, [Validators.required, this.validateName()]],
                tagType: [this.data.tag.type, Validators.required],
                tagAddress: [this.data.tag.address, Validators.required],
                tagDescription: [this.data.tag.description]
            });
            const signal = this.hmiService.getAllSignals()[this.data.tag.id];
            this.currentValue = signal?.value;
            this.manualValue = signal?.value;
            this.hmiService.onVariableChanged.pipe(takeUntil(this.destroy$)).subscribe(changed => {
                if (changed.id === this.data.tag.id) {
                    this.currentValue = changed.value;
                    this.writeMessage = `Confirmed value: ${changed.value}`;
                    if (this.writeLogVisible) this.addWriteLog(true, `Polled value: ${changed.value}`);
                }
            });
            this.hmiService.askDeviceValues();
            return;
        }
        this.hmiService.onDeviceBrowse.pipe(takeUntil(this.destroy$)).subscribe(response => {
            if (this.data.device.id !== response.device || response.error) {
                return;
            }
            this.addNodes(response.node?.search != null ? null : response.node, response.result);
        });
        this.queryNext(null);
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    queryNext(node: Node) {
        const request = node ? { id: node.id, parent: node.parent?.id || null, sort: this.sortDirection } : null;
        this.hmiService.askDeviceBrowse(this.data.device.id, request);
    }

    search() {
        const search = this.searchText.trim();
        this.treetable.nodes = {};
        this.treetable.list = [];
        this.hmiService.askDeviceBrowse(this.data.device.id, search ? { search, sort: this.sortDirection } : null);
    }

    addNodes(parent: Node, nodes: any[]) {
        if (!nodes) return;
        const tags = Object.values(this.data.device.tags || {});
        nodes.forEach(item => {
            // Prefix variables with their immutable gateway index so similarly
            // named ecoMAX parameters can be distinguished and searched easily.
            const displayName = item.class === 'Variable' ? `[${item.id}] ${item.name}` : item.name;
            const node = new Node(item.id, displayName);
            node.class = Node.strToType(item.class);
            node.type = item.type;
            const existingTag = tags.find((tag: Tag) => tag.address === item.id);
            const access = item.writable ? 'read/write' : 'read-only';
            const range = item.min != null || item.max != null ? `, range: ${item.min ?? '-'}..${item.max ?? '-'}` : '';
            node.property = item.class === 'Variable'
                ? `FUXA tag: ${existingTag?.name || item.name} | ${item.type}, ${access}${item.unit != null ? `, unit: ${item.unit}` : ''}${range}`
                : '';
            node.todefine = {
                writable: item.writable,
                unit: item.unit,
                min: item.min,
                max: item.max,
                econextType: item.econextType,
                gatewayName: item.name
            };
            const enabled = node.class !== NodeType.Variable || !existingTag;
            this.treetable.addNode(node, parent, enabled, false);
        });
        // The gateway already returns parameters in numeric index order.
        this.treetable.update(false);
    }

    onNoClick() {
        this.dialogRef.close();
    }

    onOkClick() {
        if (this.data.tag) {
            this.data.tagProperty = this.formGroup.getRawValue();
            this.result.emit(this.data);
            return;
        }
        this.data.nodes = (<Node[]>Object.values(this.treetable.nodes)).filter((node: Node) =>
            node.checked && node.enabled && (node.type || !node.childs || node.childs.length === 0)
        );
        this.result.emit(this.data);
    }

    async writeValue() {
        this.writeLogVisible = true;
        const tag = this.data.tag;
        if (!tag?.options?.writable) {
            this.writeMessage = 'This gateway parameter is read-only.';
            return;
        }
        let value: any = this.manualValue;
        if (String(tag.type).toLowerCase() === 'number') {
            value = Number(value);
            if (!Number.isFinite(value)) {
                this.writeMessage = 'Enter a valid number.';
                return;
            }
            if (tag.options.min != null && value < tag.options.min) {
                this.writeMessage = `Minimum value is ${tag.options.min}.`;
                return;
            }
            if (tag.options.max != null && value > tag.options.max) {
                this.writeMessage = `Maximum value is ${tag.options.max}.`;
                return;
            }
        }
        this.writeMessage = 'Writing value...';
        const result = await this.hmiService.putSignalValueWithResult(tag.id, value);
        this.writeMessage = result.success ? 'Write successful: true' : `Write successful: false${result.error ? ` — ${result.error}` : ''}`;
        this.addWriteLog(result.success, result.success ? `Sent value: ${value}` : (result.error || `Write rejected: ${value}`), result.details);
        if (result.success) this.hmiService.askDeviceValues();
    }

    private addWriteLog(success: boolean, message: string, details?: any) {
        this.writeLog.unshift({ time: new Date().toLocaleTimeString(), success, message, details });
        this.writeLog = this.writeLog.slice(0, 4);
    }

    validateName(): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            const name = control?.value;
            if (this.existingNames.includes(name)) {
                return { name: this.translateService.instant('msg.device-tag-exist') };
            }
            if (name?.includes('@')) {
                return { name: this.translateService.instant('msg.device-tag-invalid-char') };
            }
            return null;
        };
    }
}

export interface TagPropertyPlumEconextData {
    device: Device;
    nodes?: Node[];
    tag?: Tag;
    tagProperty?: any;
}
