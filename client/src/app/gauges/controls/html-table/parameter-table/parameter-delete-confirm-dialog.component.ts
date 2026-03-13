import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ParameterTableOptions } from '../../../../_models/hmi';

export interface ParameterDeleteConfirmDialogData {
    msg: string;
    tableOptions?: ParameterTableOptions;
}

@Component({
    selector: 'app-parameter-delete-confirm-dialog',
    template: `
        <div class="modal-backdrop" (click)="onCancel()">
            <div class="modal-content" (click)="$event.stopPropagation()">
                <div class="parameter-delete-confirm-dialog"
                     [style.--parameter-delete-toolbar-color]="data?.tableOptions?.toolbar?.color || data?.tableOptions?.header?.color || 'inherit'"
                     [style.--parameter-delete-toolbar-bg]="data?.tableOptions?.toolbar?.background || data?.tableOptions?.header?.background || 'inherit'"
                     [style.--parameter-delete-toolbar-button-bg]="data?.tableOptions?.toolbar?.buttonColor || data?.tableOptions?.header?.background || 'inherit'"
                     [style.--parameter-delete-row-bg]="data?.tableOptions?.row?.background || 'inherit'"
                     [style.--parameter-delete-row-color]="data?.tableOptions?.row?.color || 'inherit'"
                     [style.--parameter-delete-grid-color]="data?.tableOptions?.gridColor || 'rgba(0,0,0,0.12)'">
                    <h2 class="dialog-title">
                        <span>{{'parameter.dialog.delete-title' | translate}}</span>
                        <button class="close-btn" (click)="onCancel()" aria-label="Close dialog">
                            <span>&times;</span>
                        </button>
                    </h2>
                    <div class="dialog-content">
                        <p>{{ data?.msg }}</p>
                    </div>
                    <div class="dialog-actions">
                        <button class="cancel-btn" (click)="onCancel()">{{'parameter.dialog.cancel' | translate}}</button>
                        <button class="save-btn" (click)="onConfirm()">{{'parameter.dialog.delete' | translate}}</button>
                    </div>
                </div>
            </div>
        </div>
    `,
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

        .parameter-delete-confirm-dialog {
            width: 520px !important;
            max-width: 520px !important;
            background-color: var(--parameter-delete-row-bg, #ffffff) !important;
            color: var(--parameter-delete-row-color, inherit) !important;
            box-shadow: 0 12px 28px rgba(0, 0, 0, 0.12) !important;
            display: flex;
            flex-direction: column;
            padding: 0 !important;
            height: auto !important;
        }

        .parameter-delete-confirm-dialog .dialog-title {
            background: var(--parameter-delete-toolbar-bg, #f7f7f7) !important;
            color: var(--parameter-delete-toolbar-color, #424242) !important;
            margin: 0 !important;
            padding: 8px 20px 8px 30px !important;
            font-weight: 600 !important;
            font-size: 18px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 12px !important;
            border-bottom: 1px solid var(--parameter-delete-grid-color, rgba(0,0,0,0.12)) !important;
            min-height: 28px !important;
            position: relative !important;
        }

        .parameter-delete-confirm-dialog .close-btn {
            color: var(--parameter-delete-toolbar-color, #424242) !important;
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

        .parameter-delete-confirm-dialog .close-btn span {
            font-size: 24px;
            line-height: 1;
        }

        .parameter-delete-confirm-dialog .dialog-content {
            padding: 20px !important;
            background: transparent !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 14px !important;
        }

        .parameter-delete-confirm-dialog .dialog-content p {
            color: var(--parameter-delete-row-color, inherit) !important;
            font-size: 14px !important;
            margin: 0 !important;
            line-height: 1.5 !important;
        }

        .parameter-delete-confirm-dialog .dialog-actions {
            padding: 8px 20px !important;
            background: var(--parameter-delete-toolbar-bg, #f7f7f7) !important;
            min-height: 28px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: flex-end !important;
            gap: 12px !important;
            border-top: 1px solid var(--parameter-delete-grid-color, rgba(0,0,0,0.12)) !important;
            margin: 0 !important;
        }

        .parameter-delete-confirm-dialog .dialog-actions button {
            height: 36px !important;
            padding: 0 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: background-color 0.2s;
        }

        .parameter-delete-confirm-dialog .cancel-btn {
            color: var(--parameter-delete-toolbar-color, inherit) !important;
            background: transparent !important;
            min-width: 80px !important;
        }

        .parameter-delete-confirm-dialog .cancel-btn:hover {
            background: rgba(0, 0, 0, 0.04) !important;
        }

        .parameter-delete-confirm-dialog .save-btn {
            background-color: var(--parameter-delete-toolbar-button-bg, var(--parameter-delete-toolbar-bg, #e0e0e0)) !important;
            color: var(--parameter-delete-toolbar-color, #212121) !important;
            min-width: 80px !important;
        }

        .parameter-delete-confirm-dialog .save-btn:hover {
            opacity: 0.9;
        }

        @media (max-width: 600px) {
            .parameter-delete-confirm-dialog {
                width: 480px !important;
                max-width: calc(100vw - 32px) !important;
            }

            .parameter-delete-confirm-dialog .dialog-title,
            .parameter-delete-confirm-dialog .dialog-actions {
                padding-left: 16px !important;
                padding-right: 16px !important;
            }

            .parameter-delete-confirm-dialog .close-btn {
                width: 28px !important;
                height: 28px !important;
                min-width: 28px !important;
            }

            .parameter-delete-confirm-dialog .close-btn span {
                font-size: 20px !important;
            }

            .parameter-delete-confirm-dialog .dialog-content {
                padding: 16px !important;
                gap: 12px !important;
            }
        }
        `
    ]
})
export class ParameterDeleteConfirmDialogComponent implements OnInit {
    @Input() data: ParameterDeleteConfirmDialogData;
    @Output() close = new EventEmitter<boolean>();

    ngOnInit() {}

    onCancel(): void {
        this.close.emit(false);
    }

    onConfirm(): void {
        this.close.emit(true);
    }
}