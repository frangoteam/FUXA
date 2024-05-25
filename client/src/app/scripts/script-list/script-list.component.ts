import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { Subscription } from 'rxjs';

import { TranslateService } from '@ngx-translate/core';
import { ProjectService } from '../../_services/project.service';
import { ScriptEditorComponent } from '../script-editor/script-editor.component';
import { ScriptSchedulingComponent, SchedulingData } from '../script-scheduling/script-scheduling.component';
import { Script, SCRIPT_PREFIX, ScriptScheduling, ScriptSchedulingMode } from '../../_models/script';
import { Utils } from '../../_helpers/utils';
import { ScriptPermissionComponent } from '../script-permission/script-permission.component';
import { ScriptModeComponent } from '../script-mode/script-mode.component';

@Component({
    selector: 'app-script-list',
    templateUrl: './script-list.component.html',
    styleUrls: ['./script-list.component.css']
})
export class ScriptListComponent implements OnInit, AfterViewInit, OnDestroy {

    displayedColumns = ['select', 'name', 'params', 'scheduling', 'mode', 'options', 'remove'];
    dataSource = new MatTableDataSource([]);

    private subscriptionLoad: Subscription;

    @ViewChild(MatTable, {static: false}) table: MatTable<any>;
    @ViewChild(MatSort, {static: false}) sort: MatSort;

    constructor(public dialog: MatDialog,
        private translateService: TranslateService,
        private projectService: ProjectService) { }


    ngOnInit() {
        this.loadScripts();
        this.subscriptionLoad = this.projectService.onLoadHmi.subscribe(res => {
            this.loadScripts();
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

    onAddScript() {
        let script = new Script(Utils.getGUID(SCRIPT_PREFIX));
        script.name = Utils.getNextName('script_', this.dataSource.data.map(s => s.name));
		this.editScript(script, 1);
    }

    onEditScript(script: Script) {
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
            disableClose: true,
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
                if (result) {result += ', ';}
                result += `${param.name}: ${param.type}`;
            });
            return result;
        }
        return '';
    }

    getScheduling(script: Script) {
        if (script.scheduling) {
            let result = '';
            if (script.scheduling.mode) {
                result = this.translateService.instant('script.scheduling-' + script.scheduling.mode) + ' - ';
            }
            if (script.scheduling.mode ===  ScriptSchedulingMode.interval || script.scheduling.mode === ScriptSchedulingMode.start) {
                if (script.scheduling.interval) {
                    result += `${script.scheduling.interval} sec.`;
                } else {
                    result += this.translateService.instant('report.scheduling-none');
                }
            } else if (script.scheduling.mode === ScriptSchedulingMode.scheduling) {
                result += `${script.scheduling.schedules?.length}`;
            }
            return result;
        }
        return '';
    }

    onEditScriptScheduling(script: Script) {
        let dialogRef = this.dialog.open(ScriptSchedulingComponent, {
            data: <SchedulingData> { scheduling: script.scheduling },
            disableClose: true,
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
            disableClose: true,
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

    onEditScriptMode(script: Script) {
        let dialogRef = this.dialog.open(ScriptModeComponent, {
            disableClose: true,
            position: { top: '60px' },
            data: { mode: script.mode }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                script.mode = result.mode;
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
