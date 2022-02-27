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

    displayedColumns = ['select', 'name', 'type', 'remove'];
    dataSource = new MatTableDataSource([]);

    private subscriptionLoad: Subscription;

    @ViewChild(MatTable) table: MatTable<any>;
    @ViewChild(MatSort) sort: MatSort;

    constructor(public dialog: MatDialog,
        private translateService: TranslateService,
        private projectService: ProjectService) { }


    ngOnInit() {
        this.loadScripts();
        this.subscriptionLoad = this.projectService.onLoadHmi.subscribe(res => {
            this.loadScripts();
        });
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

    onEditScript(script: Script, toAdd: number) {
		this.editScript(script, 0);
    }

    onRemoveScript(script: Script) {
		this.editScript(script, -1);
    }

    editScript(script: Script, toAdd: number) {
        let dlgwidth = (toAdd < 0) ? 'auto' : '80%';
        let scripts = this.dataSource.data.filter(s => s.id !== script.id);
		let mscript: Script = JSON.parse(JSON.stringify(script));
        let dialogRef = this.dialog.open(ScriptEditorComponent, {
            data: { script: mscript, editmode: toAdd, scripts: scripts, devices: Object.values(this.projectService.getDevices()) },
            width: dlgwidth,
            position: { top: '80px' }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                if (toAdd < 0) {
                    this.projectService.removeScript(result).subscribe(result => {
                        this.loadScripts();
                    });
				} else {
                    this.projectService.setScript(result, script).subscribe(() => {
                        this.loadScripts();
                    });
                }
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

    private loadScripts() {
        this.dataSource.data = this.projectService.getScripts(); 
	}
}
