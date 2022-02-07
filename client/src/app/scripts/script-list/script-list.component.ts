import { Component, OnInit, AfterViewInit, OnDestroy, Inject, ViewChild } from '@angular/core';
import { MatDialog, MatDialogRef, MatTable, MatTableDataSource, MAT_DIALOG_DATA, MatSort, MatMenuTrigger } from '@angular/material';
import { Subscription } from "rxjs";

import { TranslateService } from '@ngx-translate/core';
import { ProjectService } from '../../_services/project.service';
import { ScriptEditorComponent } from '../script-editor/script-editor.component';
import { Script, SCRIPT_PREFIX } from '../../_models/script';
import { AlarmsType } from '../../_models/alarm';
import { Utils } from '../../_helpers/utils';

@Component({
    selector: 'app-script-list',
    templateUrl: './script-list.component.html',
    styleUrls: ['./script-list.component.css']
})
export class ScriptListComponent implements OnInit, AfterViewInit, OnDestroy {

    displayedColumns = ['select', 'name', 'params', 'type', 'remove'];
    dataSource = new MatTableDataSource([]);

    @ViewChild(MatTable) table: MatTable<any>;
    @ViewChild(MatSort) sort: MatSort;

    constructor(public dialog: MatDialog,
        private translateService: TranslateService,
        private projectService: ProjectService) { }


    ngOnInit() {
        // this.loadNotifications();
        // this.subscriptionLoad = this.projectService.onLoadHmi.subscribe(res => {
        //     this.loadNotifications();
        // });
        // Object.values(this.alarmsEnum).forEach(key => {
        //     this.translateService.get('alarm.property-' + key).subscribe((txt: string) => { this.alarmsType[key] = txt });
        // });
    }

    ngAfterViewInit() {
        this.dataSource.sort = this.sort;
    }

    ngOnDestroy() {
        try {
            // if (this.subscriptionLoad) {
            //     this.subscriptionLoad.unsubscribe();
            // }
        } catch (e) {
        }
    }

    onAddScript() {
        let script = new Script(Utils.getGUID(SCRIPT_PREFIX));
		this.editScript(script, 1);
    }

    // onEditNotification(notification: Notification, toAdd: number) {
	// 	this.editNotification(notification, 0);
    // }

    // onRemoveNotification(notification: Notification) {
	// 	this.editNotification(notification, -1);
    // }

    editScript(script: Script, toAdd: number) {
		let mscript: Script = JSON.parse(JSON.stringify(script));
        let dialogRef = this.dialog.open(ScriptEditorComponent, {
            data: { script: mscript, editmode: toAdd, scripts: this.dataSource.data },
            position: { top: '80px' }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                // if (toAdd < 0) {
                //     this.projectService.removeNotification(result).subscribe(result => {
                //         this.loadNotifications();
                //     });
				// } else {
                //     this.projectService.setNotification(result, notification).subscribe(result => {
                //         this.loadNotifications();
                //     });
                // }
            }
        });
    }

    getSubProperty(notification: Notification) {
        // if (notification) {
        //     if (notification.type === this.notificationAlarm) {
        //         let result = '';
        //         Object.keys(notification.subscriptions).forEach(key => {
        //             if (notification.subscriptions[key]) {
        //                 if (result) result += ', ';
        //                 result += this.alarmsType[key];
        //             }
        //         });
        //         return result;
        //     }
        // }
        return '';
    }

    private loadNotifications() {
        this.dataSource.data = this.projectService.getNotifications(); 
	}
}
