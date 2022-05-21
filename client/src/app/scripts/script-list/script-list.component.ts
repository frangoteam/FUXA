import { Component, OnInit, AfterViewInit, OnDestroy, Inject, ViewChild } from '@angular/core';
import { MatDialog, MatDialogRef, MatTable, MatTableDataSource, MAT_DIALOG_DATA, MatSort, MatMenuTrigger } from '@angular/material';
import { Subscription } from "rxjs";

import { TranslateService } from '@ngx-translate/core';
import { ProjectService } from '../../_services/project.service';
import { ScriptEditorComponent } from '../script-editor/script-editor.component';
import { ScriptSchedulingComponent, SchedulingData } from '../script-scheduling/script-scheduling.component';
import { Script, SCRIPT_PREFIX, ScriptScheduling } from '../../_models/script';
import { AlarmsType } from '../../_models/alarm';
import { Utils } from '../../_helpers/utils';
import { ScriptPermissionComponent } from '../script-permission/script-permission.component';

@Component({
    selector: 'app-script-list',
    templateUrl: './script-list.component.html',
    styleUrls: ['./script-list.component.css']
})
export class ScriptListComponent implements OnInit, AfterViewInit, OnDestroy {

    displayedColumns = ['select', 'name', 'params', 'scheduling', 'type', 'options', 'remove'];
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

    getParameters(script: Script) {
        if (script.parameters) {
            let result = '';
            Object.values(script.parameters).forEach(param => {
                if (result) result += ', ';
                result += `${param.name}: ${param.type}`;
            });
            return result;
        }
        return '';
    }

    getScheduling(script: Script) {
        if (script.scheduling) {
            let result = '';
            if (script.scheduling.interval) {
                result += `${script.scheduling.interval} sec.`;
            }
            return result;
        }
        return '';
    }

    onEditScriptScheduling(script: Script) {
        let dialogRef = this.dialog.open(ScriptSchedulingComponent, {
            data: <SchedulingData> { scheduling: script.scheduling },
            position: { top: '60px' }
        });
        dialogRef.afterClosed().subscribe((result: ScriptScheduling) => {
            if (result) {
                script.scheduling = result;
                this.projectService.setScript(script, null).subscribe(() => {
                    this.loadScripts();
                });
            }
        });
    }

    onEditScriptPermission(script: Script) {
        let permission = script.permission;
        let dialogRef = this.dialog.open(ScriptPermissionComponent, {
            position: { top: '60px' },
            data: { permission: permission }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                script.permission = result.permission;
                this.projectService.setScript(script, null).subscribe(() => {
                    this.loadScripts();
                });                
            }
        });
    }


    private loadScripts() {
        this.dataSource.data = this.projectService.getScripts(); 
	}
}
