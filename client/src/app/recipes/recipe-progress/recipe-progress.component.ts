import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Subscription } from 'rxjs';

import { HmiService } from '../../_services/hmi.service';
import { RecipeProgressEvent, RecipeCompleteEvent } from '../../_models/recipe';

@Component({
    selector: 'app-recipe-progress',
    templateUrl: './recipe-progress.component.html',
    styleUrls: ['./recipe-progress.component.css']
})
export class RecipeProgressComponent implements OnInit, OnDestroy {
    progressEntries: { entryId: string; tagName: string; status: string; error?: string }[] = [];
    currentIndex = 0;
    totalEntries: number;
    completed = false;
    successCount = 0;
    errorCount = 0;
    private subscription: Subscription = new Subscription();

    constructor(
        public dialogRef: MatDialogRef<RecipeProgressComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any,
        private hmiService: HmiService
    ) {
        this.totalEntries = data.totalEntries || 0;
    }

    ngOnInit() {
        const recipeId = this.data.recipeId;
        const isDownload = this.data.mode === 'download';

        const progressEvent = isDownload ? this.hmiService.onRecipeDownloadProgress : this.hmiService.onRecipeUploadProgress;
        const completeEvent = isDownload ? this.hmiService.onRecipeDownloadComplete : this.hmiService.onRecipeUploadComplete;
        const errorEvent = isDownload ? this.hmiService.onRecipeDownloadError : this.hmiService.onRecipeUploadError;

        this.subscription.add(
            progressEvent.subscribe((event: RecipeProgressEvent) => {
                if (event.recipeId !== recipeId) return;
                this.currentIndex = event.index + 1;
                const existing = this.progressEntries.find(e => e.entryId === event.entryId);
                if (existing) {
                    existing.status = event.status;
                    existing.error = event.error;
                } else {
                    this.progressEntries.push({
                        entryId: event.entryId || '',
                        tagName: event.tagName || '',
                        status: event.status,
                        error: event.error
                    });
                }
            })
        );

        this.subscription.add(
            completeEvent.subscribe((event: RecipeCompleteEvent) => {
                if (event.recipeId !== recipeId) return;
                this.completed = true;
                this.successCount = event.successCount;
                this.errorCount = event.errorCount;
            })
        );

        this.subscription.add(
            errorEvent.subscribe((event: any) => {
                if (event.recipeId !== recipeId) return;
                this.completed = true;
                this.errorCount = this.totalEntries;
            })
        );

        this.subscription.add(
            this.hmiService.onRecipeCanceled.subscribe((event: any) => {
                if (event.recipeId !== recipeId) return;
                this.completed = true;
                this.dialogRef.close();
            })
        );
    }

    ngOnDestroy() {
        this.subscription.unsubscribe();
    }

    onCancel() {
        this.hmiService.cancelRecipeExecution(this.data.recipeId);
    }

    onClose() {
        this.dialogRef.close();
    }

    getProgressPercent(): number {
        if (this.totalEntries === 0) return 0;
        return Math.round((this.currentIndex / this.totalEntries) * 100);
    }
}
