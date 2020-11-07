import { Component, OnInit, AfterViewInit, OnDestroy, Inject, ViewChild } from '@angular/core';
import { MatDialog, MatDialogRef, MatTable, MatTableDataSource, MAT_DIALOG_DATA, MatSort, MatMenuTrigger } from '@angular/material';
import { SelectionModel } from '@angular/cdk/collections';
import { Subscription } from "rxjs";

import { ProjectService } from '../_services/project.service';
import { Text } from '../_models/text';

@Component({
    selector: 'app-text-list',
    templateUrl: './text-list.component.html',
    styleUrls: ['./text-list.component.css']
})
export class TextListComponent implements OnInit, AfterViewInit, OnDestroy {

    displayedColumns = ['select', 'id', 'group', 'value', 'remove'];
    dataSource = new MatTableDataSource([]);
    selection = new SelectionModel<Element>(true, []);

    private subscriptionLoad: Subscription;

    @ViewChild(MatTable) table: MatTable<any>;
    @ViewChild(MatSort) sort: MatSort;

    constructor(public dialog: MatDialog,
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
		let text = new Text();
		this.editText(text, 1);
    }

    onEditText(text: Text) {
		this.editText(text, 0);
    }

    onRemoveText(text: Text) {
		this.editText(text, -1);
	}
    
    editText(text: Text, toAdd: number) {
		let mtext: Text = JSON.parse(JSON.stringify(text));
        let dialogRef = this.dialog.open(DialogItemText, {
            position: { top: '60px' },
            data: { text: mtext, editmode: toAdd, texts: this.dataSource.data }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                if (toAdd < 0) {
					this.projectService.removeText(result);
				} else {
                    this.projectService.setText(result, text);
                }
                this.loadTexts();
            }
        });
    }

    private loadTexts() {
        this.dataSource.data = this.projectService.getTexts(); 
	}
}

@Component({
    selector: 'dialog-item-text',
    templateUrl: './item-text.dialog.html',
    styleUrls: ['./text-list.component.css']
})
export class DialogItemText {

    existtexts = [];
    errorExist = false;
    errorMissingValue = false;

    constructor(
        public dialogRef: MatDialogRef<DialogItemText>,
        @Inject(MAT_DIALOG_DATA) public data: any) { 
            if (data.editmode > 0) {
                data.text.name = this.getNextTextId();
            }
            if (data.texts) {
                this.existtexts = data.texts.filter(t => t.name !== data.text.name);
            }
        }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        if (this.data.editmode < 0 || this.checkValid())
            this.dialogRef.close(this.data.text);
    }

    checkValid() {
        this.errorMissingValue = (!this.data.text.name || !this.data.text.value);
        this.errorExist = (this.existtexts.find((tx) => tx.name === this.data.text.name)) ? true : false;
        return !(this.errorMissingValue || this.errorExist);
    }

    private getNextTextId() {
        let prefix = 'text_';
        let num = 1;
        if (this.data.texts) {
            while (this.data.texts.find((tx) => tx.name === prefix + num)) {
                num++;
            }
        }
        return prefix + num;
    }
}
