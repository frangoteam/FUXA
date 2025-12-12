import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ParameterTableOptions, ParameterType, ParameterSet } from '../../../../_models/hmi';

export interface ParameterSetDialogData {
    mode: 'add' | 'copy' | 'rename';
    parameterType?: ParameterType;
    parameterSet?: ParameterSet;
    tableOptions?: ParameterTableOptions; // To get colors
}

@Component({
    selector: 'app-parameter-set-dialog',
    standalone: true,
    template: `
        <div class="modal-backdrop" (click)="onCancel()">
            <div class="modal-content" (click)="$event.stopPropagation()">
                <div class="parameter-set-dialog"
                     [style.--parameter-set-toolbar-color]="data?.tableOptions?.toolbar?.color || data?.tableOptions?.header?.color || 'inherit'"
                     [style.--parameter-set-toolbar-bg]="data?.tableOptions?.toolbar?.background || data?.tableOptions?.header?.background || 'inherit'"
                     [style.--parameter-set-toolbar-button-bg]="data?.tableOptions?.toolbar?.buttonColor || data?.tableOptions?.header?.background || 'inherit'"
                     [style.--parameter-set-row-bg]="data?.tableOptions?.row?.background || 'inherit'"
                     [style.--parameter-set-row-color]="data?.tableOptions?.row?.color || 'inherit'"
                     [style.--parameter-set-grid-color]="data?.tableOptions?.gridColor || 'rgba(0,0,0,0.12)'">
                    <h2 class="dialog-title">
                        <span *ngIf="data?.mode === 'add'">{{'parameter.dialog.add-title' | translate}}</span>
                        <span *ngIf="data?.mode === 'copy'">{{'parameter.dialog.copy-title' | translate}}</span>
                        <span *ngIf="data?.mode === 'rename'">{{'parameter.dialog.rename-title' | translate}}</span>
                        <button class="close-btn" (click)="onCancel()" aria-label="Close dialog">
                            <span>&times;</span>
                        </button>
                    </h2>
                    <div class="dialog-content">
                        <div class="form-field">
                            <label>{{'parameter.dialog.name-label' | translate}}</label>
                            <input [(ngModel)]="setName" required>
                        </div>
                        <div class="form-field">
                            <label>{{'parameter.dialog.description-label' | translate}}</label>
                            <textarea [(ngModel)]="setDescription" rows="2"></textarea>
                        </div>
                        <div class="form-field">
                            <label>{{'parameter.dialog.user-id-label' | translate}}</label>
                            <input [(ngModel)]="setUserId">
                        </div>
                    </div>
                    <div class="dialog-actions">
                        <button class="cancel-btn" (click)="onCancel()">{{'parameter.dialog.cancel' | translate}}</button>
                        <button class="save-btn" [disabled]="!setName" (click)="onSave()">{{'parameter.dialog.save' | translate}}</button>
                    </div>
                </div>
            </div>
        </div>
    `,
    imports: [FormsModule, TranslateModule],
    styles: [
        `
        .modal-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }

        .modal-content {
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            max-width: 90vw;
            max-height: 90vh;
            overflow: auto;
        }

        .parameter-set-dialog {
            width: 520px !important;
            max-width: 520px !important;
            background-color: var(--parameter-set-row-bg, #ffffff) !important;
            color: var(--parameter-set-row-color, inherit) !important;
            box-shadow: 0 12px 28px rgba(0, 0, 0, 0.12) !important;
            display: flex;
            flex-direction: column;
            padding: 0 !important;
            height: auto !important;
        }

        .parameter-set-dialog .dialog-title {
            background: var(--parameter-set-toolbar-bg, #f7f7f7) !important;
            color: var(--parameter-set-toolbar-color, #424242) !important;
            margin: 0 !important;
            padding: 8px 20px 8px 30px !important;
            font-weight: 600 !important;
            font-size: 18px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 12px !important;
            border-bottom: 1px solid var(--parameter-set-grid-color, rgba(0,0,0,0.12)) !important;
            min-height: 28px !important;
            position: relative !important;
        }

        .parameter-set-dialog .close-btn {
            color: var(--parameter-set-toolbar-color, #424242) !important;
            width: 32px !important;
            height: 32px !important;
            min-width: 32px !important;
            border-radius: 50% !important;
            border: 1px solid transparent !important;
            background: transparent !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            position: absolute !important;
            top: 50% !important;
            right: 20px !important;
            transform: translateY(-50%) !important;
            cursor: pointer;
        }

        .parameter-set-dialog .close-btn span {
            font-size: 24px;
            line-height: 1;
        }

        .parameter-set-dialog .dialog-content {
            padding: 20px !important;
            background: transparent !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 16px !important;
        }

        .parameter-set-dialog .form-field {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .parameter-set-dialog .form-field label {
            font-size: 14px;
            font-weight: 500;
            color: var(--parameter-set-row-color, inherit);
        }

        .parameter-set-dialog .form-field input,
        .parameter-set-dialog .form-field textarea {
            padding: 12px;
            border: 1px solid var(--parameter-set-grid-color, rgba(0,0,0,0.12));
            border-radius: 4px;
            background-color: var(--parameter-set-row-bg, #ffffff);
            color: var(--parameter-set-row-color, inherit);
            font-size: 14px;
            transition: border-color 0.2s;
        }

        .parameter-set-dialog .form-field input:focus,
        .parameter-set-dialog .form-field textarea:focus {
            outline: none;
            border-color: var(--parameter-set-toolbar-color, inherit);
        }

        .parameter-set-dialog .form-field textarea {
            resize: vertical;
            min-height: 60px;
        }

        .parameter-set-dialog .dialog-actions {
            padding: 8px 20px !important;
            background: var(--parameter-set-toolbar-bg, #f7f7f7) !important;
            min-height: 28px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: flex-end !important;
            gap: 12px !important;
            border-top: 1px solid var(--parameter-set-grid-color, rgba(0,0,0,0.12)) !important;
            margin: 0 !important;
        }

        .parameter-set-dialog .dialog-actions button {
            height: 36px !important;
            padding: 0 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: background-color 0.2s;
        }

        .parameter-set-dialog .cancel-btn {
            color: var(--parameter-set-toolbar-color, inherit) !important;
            background: transparent !important;
            min-width: 80px !important;
        }

        .parameter-set-dialog .cancel-btn:hover {
            background: rgba(0, 0, 0, 0.04) !important;
        }

        .parameter-set-dialog .save-btn {
            background-color: var(--parameter-set-toolbar-button-bg, var(--parameter-set-toolbar-bg, #e0e0e0)) !important;
            color: var(--parameter-set-toolbar-color, #212121) !important;
            min-width: 80px !important;
        }

        .parameter-set-dialog .save-btn:hover:not(:disabled) {
            opacity: 0.9;
        }

        .parameter-set-dialog .save-btn:disabled {
            background-color: var(--parameter-set-grid-color, rgba(0,0,0,0.12)) !important;
            color: var(--parameter-set-row-color, rgba(0,0,0,0.38)) !important;
            cursor: not-allowed;
        }

        @media (max-width: 600px) {
            .parameter-set-dialog {
                width: 480px !important;
                max-width: calc(100vw - 32px) !important;
            }

            .parameter-set-dialog .dialog-title,
            .parameter-set-dialog .dialog-actions {
                padding-left: 16px !important;
                padding-right: 16px !important;
            }

            .parameter-set-dialog .close-btn {
                width: 28px !important;
                height: 28px !important;
                min-width: 28px !important;
            }

            .parameter-set-dialog .close-btn span {
                font-size: 20px !important;
            }

            .parameter-set-dialog .dialog-content {
                padding: 16px !important;
                gap: 12px !important;
            }
        }
        `
    ]
})
export class ParameterSetDialogComponent implements OnInit {
    @Input() data: ParameterSetDialogData;
    @Output() close = new EventEmitter<any>();

    setName = '';
    setDescription = '';
    setUserId = '';

    ngOnInit() {
        if (this.data?.mode === 'copy' || this.data?.mode === 'rename') {
            this.setName = this.data.parameterSet?.name || '';
            this.setDescription = this.data.parameterSet?.description || '';
            this.setUserId = this.data.parameterSet?.userId || '';
        }
    }

    onCancel(): void {
        this.close.emit();
    }

    onSave(): void {
        if (this.setName.trim()) {
            this.close.emit({
                name: this.setName.trim(),
                description: this.setDescription.trim(),
                userId: this.setUserId.trim()
            });
        }
    }
}
