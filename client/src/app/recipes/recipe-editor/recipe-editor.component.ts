import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';

import { RecipeService } from '../../_services/recipe.service';
import { TagBrowserComponent } from '../tag-browser/tag-browser.component';
import { MatDialog } from '@angular/material/dialog';

@Component({
    selector: 'app-recipe-editor',
    templateUrl: './recipe-editor.component.html',
    styleUrls: ['./recipe-editor.component.css']
})
export class RecipeEditorComponent implements OnInit {
    recipeName = '';
    recipeDescription = '';
    displayedColumns: string[] = ['tagName', 'tagId', 'tagType', 'actions'];
    dataSource = new MatTableDataSource<any>([]);
    saving = false;
    isNew: boolean;

    constructor(
        public dialogRef: MatDialogRef<RecipeEditorComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any,
        private recipeService: RecipeService,
        private dialog: MatDialog,
        private translate: TranslateService,
        private toastr: ToastrService
    ) {
        this.isNew = data?.newRecipe !== false;
    }

    ngOnInit() {
        if (this.data?.recipe) {
            this.recipeName = this.data.recipe.name || '';
            this.recipeDescription = this.data.recipe.description || '';
            this.dataSource.data = this.data.recipe.entries || [];
        }
    }

    onAddEntry() {
        const dialogRef = this.dialog.open(TagBrowserComponent, {
            width: '600px',
            data: {}
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                const exists = this.dataSource.data.find(e => e.tagId === result.tagId);
                if (!exists) {
                    const newEntry = {
                        id: 'e_' + Math.random().toString(16).substring(2, 10),
                        tagId: result.tagId,
                        tagName: result.tagName,
                        tagType: result.tagType,
                        value: ''
                    };
                    this.dataSource.data = [...this.dataSource.data, newEntry];
                }
            }
        });
    }

    onRemoveEntry(entry: any) {
        this.dataSource.data = this.dataSource.data.filter(e => e !== entry);
    }

    onSave() {
        if (!this.recipeName || this.recipeName.trim() === '') {
            this.toastr.error('Name is required');
            return;
        }
        if (this.dataSource.data.length === 0) {
            this.toastr.error('At least one entry is required');
            return;
        }

        this.saving = true;
        const recipeData: any = {
            name: this.recipeName.trim(),
            entries: this.dataSource.data
        };
        if (this.recipeDescription) {
            recipeData.description = this.recipeDescription.trim();
        }
        if (!this.isNew && this.data?.recipe?.id) {
            recipeData.id = this.data.recipe.id;
        }

        this.recipeService.saveRecipe(recipeData).subscribe(result => {
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
}
