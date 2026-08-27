import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { Subscription } from 'rxjs';

import { RecipeService } from '../../_services/recipe.service';
import { HmiService } from '../../_services/hmi.service';
import { RecipeCompleteEvent } from '../../_models/recipe';
import { RecipeEditorComponent } from '../recipe-editor/recipe-editor.component';
import { RecipeProgressComponent } from '../recipe-progress/recipe-progress.component';
import { ConfirmDialogComponent } from '../../gui-helpers/confirm-dialog/confirm-dialog.component';

@Component({
    selector: 'app-recipe-list',
    templateUrl: './recipe-list.component.html',
    styleUrls: ['./recipe-list.component.css']
})
export class RecipeListComponent implements OnInit, OnDestroy {
    displayedColumns: string[] = ['select', 'name', 'description', 'entries', 'options', 'remove'];
    dataSource = new MatTableDataSource<any>([]);
    loading = false;
    private subscription: Subscription = new Subscription();

    @ViewChild(MatSort) sort: MatSort;

    constructor(
        private recipeService: RecipeService,
        private hmiService: HmiService,
        private dialog: MatDialog,
        private translate: TranslateService,
        private toastr: ToastrService
    ) {}

    ngOnInit() {
        this.loadRecipes();
        this.subscription.add(
            this.hmiService.onRecipeDownloadComplete.subscribe((event: RecipeCompleteEvent) => {
                this.loadRecipes();
            })
        );
        this.subscription.add(
            this.hmiService.onRecipeUploadComplete.subscribe((event: RecipeCompleteEvent) => {
                this.loadRecipes();
            })
        );
    }

    ngOnDestroy() {
        this.subscription.unsubscribe();
    }

    loadRecipes() {
        this.loading = true;
        this.recipeService.getRecipeTypes().subscribe(result => {
            this.dataSource.data = result.recipes || [];
            this.dataSource.sort = this.sort;
            this.loading = false;
        }, err => {
            console.error(err);
            this.loading = false;
        });
    }

    onAddRecipe() {
        const dialogRef = this.dialog.open(RecipeEditorComponent, {
            width: '980px',
            disableClose: true,
            data: { newRecipe: true }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.loadRecipes();
            }
        });
    }

    onEditRecipe(item: any) {
        const recipeData = { id: item.id, ...item.data };
        const dialogRef = this.dialog.open(RecipeEditorComponent, {
            width: '980px',
            disableClose: true,
            data: { recipe: recipeData, newRecipe: false }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.loadRecipes();
            }
        });
    }

    onDeleteRecipe(item: any) {
        const recipeName = item.data?.name || item.id;
        const msg = this.translate.instant('recipes.delete-confirm', { name: recipeName });
        const dialogRef = this.dialog.open(ConfirmDialogComponent, {
            data: { msg: msg },
            position: { top: '60px' }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.recipeService.deleteRecipeType(item.id).subscribe(result => {
                    this.translate.get('recipes.delete-success').subscribe((txt: string) => {
                        this.toastr.success(txt);
                    });
                    this.loadRecipes();
                }, err => {
                    console.error(err);
                    this.toastr.error(err.error?.error || 'Error deleting recipe');
                });
            }
        });
    }

    onDownloadRecipe(item: any) {
        const recipeId = item.id;
        const recipeName = item.data?.name || recipeId;

        const progressDialog = this.dialog.open(RecipeProgressComponent, {
            width: '600px',
            disableClose: true,
            data: {
                recipeId: recipeId,
                recipeName: recipeName,
                mode: 'download',
                totalEntries: item.data?.entries?.length || 0
            }
        });

        this.recipeService.downloadRecipe(recipeId).subscribe(res => {
            // Dialog is already open, progress comes via Socket.IO
        }, err => {
            progressDialog.close();
            this.toastr.error(err.error?.error || 'Error starting download');
        });
    }

    onUploadRecipe(item: any) {
        const recipeId = item.id;
        const recipeName = item.data?.name || recipeId;

        const progressDialog = this.dialog.open(RecipeProgressComponent, {
            width: '600px',
            disableClose: true,
            data: {
                recipeId: recipeId,
                recipeName: recipeName,
                mode: 'upload',
                totalEntries: item.data?.entries?.length || 0
            }
        });

        this.recipeService.uploadRecipe(recipeId).subscribe(res => {
            // Progress via Socket.IO
        }, err => {
            progressDialog.close();
            this.toastr.error(err.error?.error || 'Error starting upload');
        });
    }

    onExportRecipe(item: any, format: 'json' | 'csv') {
        const recipeName = item.data?.name || 'recipe';
        this.recipeService.exportRecipe(item.id, format).subscribe(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = recipeName + '.' + format;
            a.click();
            window.URL.revokeObjectURL(url);
            this.translate.get('recipes.export-success').subscribe((txt: string) => {
                this.toastr.success(txt);
            });
        }, err => {
            console.error(err);
            this.toastr.error(err.error?.error || 'Error exporting recipe');
        });
    }

    onImportRecipe(event: any) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            this.recipeService.importRecipe({ file: content }).subscribe(res => {
                this.translate.get('recipes.import-success', { name: res.name, count: res.entriesCount }).subscribe((txt: string) => {
                    this.toastr.success(txt);
                });
                this.loadRecipes();
            }, err => {
                this.toastr.error(err.error?.error || 'Error importing recipe');
            });
        };
        reader.readAsText(file);
        event.target.value = '';
    }
}
