/* eslint-disable @angular-eslint/component-class-suffix */
import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild } from '@angular/core';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { MatLegacyTable as MatTable, MatLegacyTableDataSource as MatTableDataSource } from '@angular/material/legacy-table';
import { MatSort } from '@angular/material/sort';
import { SelectionModel } from '@angular/cdk/collections';
import { Subscription } from 'rxjs';

import { ProjectService } from '../../_services/project.service';
import { Language, LanguageText } from '../../_models/language';
import { LanguageTextPropertyComponent } from '../language-text-property/language-text-property.component';
import { LanguageTypePropertyComponent } from '../language-type-property/language-type-property.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../gui-helpers/confirm-dialog/confirm-dialog.component';
import { TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-language-text-list',
    templateUrl: './language-text-list.component.html',
    styleUrls: ['./language-text-list.component.scss']
})
export class LanguageTextListComponent implements OnInit, AfterViewInit, OnDestroy {

    displayedColumns = ['select', 'id', 'group', 'value', 'remove'];
    languages: Language[] = [];
    defaultLanguage: Language;
    dataSource = new MatTableDataSource([]);
    selection = new SelectionModel<Element>(true, []);

    private subscriptionLoad: Subscription;

    @ViewChild(MatTable, { static: false }) table: MatTable<any>;
    @ViewChild(MatSort, { static: false }) sort: MatSort;

    constructor(public dialog: MatDialog,
        private translateService: TranslateService,
        private projectService: ProjectService) { }

    ngOnInit() {
        this.loadTexts();
        this.subscriptionLoad = this.projectService.onLoadHmi.subscribe(res => {
            this.loadTexts();
        });
    }

    ngAfterViewInit() {
        this.dataSource.sort = this.sort;
    }

    ngOnDestroy() {
        try {
            if (this.subscriptionLoad) {
                this.subscriptionLoad.unsubscribe();
            }
        } catch (e) {
        }
    }

    onAddText() {
        this.editText();
    }

    onEditText(text: LanguageText) {
        this.editText(text);
    }

    onRemoveText(text: LanguageText) {
        let dialogRef = this.dialog.open(ConfirmDialogComponent, {
            position: { top: '60px' },
            data: <ConfirmDialogData> { msg: this.translateService.instant('msg.texts-text-remove', { value: text.name }) }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.projectService.removeText(text);
                this.loadTexts();
            }
        });
    }

    editText(text?: LanguageText) {
        let dialogRef = this.dialog.open(LanguageTextPropertyComponent, {
            position: { top: '60px' },
            disableClose: true,
            data: { text: text }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.projectService.setText(result);
                this.loadTexts();
            }
        });
    }

    onEditLanguage() {
        let dialogRef = this.dialog.open(LanguageTypePropertyComponent, {
            position: { top: '60px' },
            disableClose: true,
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.projectService.setLanguages(result);
                this.loadTexts();
            }
        });
    }

    private loadTexts() {
        const rawLanguages = this.projectService.getLanguages().options;
        this.defaultLanguage = this.projectService.getLanguages().default;
        this.languages = Array.isArray(rawLanguages) ? rawLanguages : Object.values(rawLanguages);

        const valueIndex = this.displayedColumns.indexOf('value');
        const removeIndex = this.displayedColumns.indexOf('remove');

        this.displayedColumns = [
            ...this.displayedColumns.slice(0, valueIndex + 1),
            ...this.languages.map(lang => `lang-${lang.id}`),
            ...this.displayedColumns.slice(removeIndex)
        ];
        const texts = this.projectService.getTexts();
        texts.forEach(text => {
            if (!text.translations) {
                text.translations = {};
            }
            this.languages.forEach(lang => {
                if (!(lang.id in text.translations)) {
                    text.translations[lang.id] = '';
                }
            });
        });
        this.dataSource.data = texts;
    }
}
