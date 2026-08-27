import { Component, Inject, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';

import { RecipeService } from '../../_services/recipe.service';
import { MatDialog } from '@angular/material/dialog';
import { ProjectService } from '../../_services/project.service';
import { DeviceTagSelectionComponent, DeviceTagSelectionData } from '../../device/device-tag-selection/device-tag-selection.component';

@Component({
    selector: 'app-recipe-editor',
    templateUrl: './recipe-editor.component.html',
    styleUrls: ['./recipe-editor.component.scss']
})
export class RecipeEditorComponent implements OnInit {
    myForm: UntypedFormGroup;
    displayedColumns: string[] = ['tagName', 'deviceName', 'tagType', 'value', 'actions'];
    dataSource = new MatTableDataSource<any>([]);
    saving = false;
    isNew: boolean;

    constructor(
        public dialogRef: MatDialogRef<RecipeEditorComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any,
        private fb: UntypedFormBuilder,
        private recipeService: RecipeService,
        private projectService: ProjectService,
        private dialog: MatDialog,
        private translate: TranslateService,
        private toastr: ToastrService
    ) {
        this.isNew = data?.newRecipe !== false;
        this.myForm = this.fb.group({
            name: [data?.recipe?.name || '', Validators.required],
            description: [data?.recipe?.description || '']
        });
    }

    ngOnInit() {
        if (this.data?.recipe) {
            this.dataSource.data = this.data.recipe.entries || [];
        }
    }

    onAddEntry() {
        const dialogRef = this.dialog.open(DeviceTagSelectionComponent, {
            disableClose: true,
            position: { top: '60px' },
            data: <DeviceTagSelectionData> {
                variableId: null,
                multiSelection: true
            }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                const tagsId = result.variablesId?.length ? result.variablesId : (result.variableId ? [result.variableId] : []);
                const newEntries = [];
                tagsId.forEach(tagId => {
                    const tag = this.projectService.getTagFromId(tagId);
                    const exists = this.dataSource.data.find(e => e.tagId === tagId);
                    if (tag && !exists) {
                        newEntries.push({
                            id: 'e_' + Math.random().toString(16).substring(2, 10),
                            tagId: tag.id,
                            tagName: tag.name,
                            tagType: tag.type || 'number',
                            value: ''
                        });
                    }
                });
                if (newEntries.length) {
                    this.dataSource.data = [...this.dataSource.data, ...newEntries];
                }
            }
        });
    }

    onRemoveEntry(entry: any) {
        this.dataSource.data = this.dataSource.data.filter(e => e !== entry);
    }

    getDeviceName(entry: any): string {
        return this.projectService.getDeviceFromTagId(entry.tagId)?.name || '';
    }

    /**
     * Map a tag type to an HTML input type so numeric tags get a number input.
     * @param tagType - Entry tag type (case-insensitive)
     */
    getInputType(tagType: string): string {
        const t = (tagType || '').toLowerCase();
        return this._isNumericType(t) ? 'number' : 'text';
    }

    /**
     * Coerce an empty entry value to a type-appropriate default so recipes
     * never write a literal '' to numeric/bool tags. Numeric tags default to
     * 0, bool tags to false; string tags keep '' (a valid string value).
     * @param entry - The entry being sanitized
     */
    private _sanitizeValue(entry: any): any {
        const value = entry.value;
        if (value === null || value === undefined || value === '') {
            const t = (entry.tagType || '').toLowerCase();
            if (t === 'bool' || t === 'boolean') {
                return false;
            }
            if (this._isNumericType(t)) {
                return 0;
            }
            return '';
        }
        return value;
    }

    private _isNumericType(tagType: string): boolean {
        return ['int', 'dint', 'int16', 'int32', 'real', 'float', 'double', 'byte', 'number'].indexOf(tagType) !== -1;
    }

    onSave() {
        if (this.myForm.invalid) {
            this.toastr.error('Name is required');
            return;
        }
        if (this.dataSource.data.length === 0) {
            this.toastr.error('At least one entry is required');
            return;
        }

        this.saving = true;
        const entries = this.dataSource.data.map(e => ({ ...e, value: this._sanitizeValue(e) }));
        const formValue = this.myForm.value;
        const recipeData: any = {
            name: formValue.name.trim(),
            entries: entries
        };
        if (formValue.description) {
            recipeData.description = formValue.description.trim();
        }
        if (!this.isNew && this.data?.recipe?.id) {
            recipeData.id = this.data.recipe.id;
        }

        this.recipeService.saveRecipeType(recipeData).subscribe(result => {
            this.saving = false;
            this.dialogRef.close(result);
        }, err => {
            this.saving = false;
            this.toastr.error(err.error?.error || 'Error saving recipe');
        });
    }

    onCancel() {
        this.dialogRef.close();
    }

    onNoClick() {
        this.onCancel();
    }
}
