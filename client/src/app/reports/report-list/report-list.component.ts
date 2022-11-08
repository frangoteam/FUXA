import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSort } from '@angular/material/sort';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { Utils } from '../../_helpers/utils';
import { Report, ReportSchedulingType, REPORT_PREFIX } from '../../_models/report';
import { CommandService } from '../../_services/command.service';
import { ProjectService } from '../../_services/project.service';
import { ReportEditorComponent } from '../report-editor/report-editor.component';

@Component({
    selector: 'app-report-list',
    templateUrl: './report-list.component.html',
    styleUrls: ['./report-list.component.css']
})
export class ReportListComponent implements OnInit, AfterViewInit, OnDestroy {

    displayedColumns = ['select', 'name', 'receiver', 'scheduling', 'type', 'create', 'remove'];
    dataSource = new MatTableDataSource([]);

    private subscriptionLoad: Subscription;
    private schedulingType = ReportSchedulingType;

    @ViewChild(MatTable, {static: false}) table: MatTable<any>;
    @ViewChild(MatSort, {static: false}) sort: MatSort;

    constructor(public dialog: MatDialog,
        private translateService: TranslateService,
        private projectService: ProjectService,
        private commandService: CommandService) { }

    ngOnInit() {
        this.loadReports();
        this.subscriptionLoad = this.projectService.onLoadHmi.subscribe(res => {
            this.loadReports();
        });

        Object.keys(this.schedulingType).forEach(key => {
            this.translateService.get(this.schedulingType[key]).subscribe((txt: string) => { this.schedulingType[key] = txt; });
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

    getScheduling(scheduling: ReportSchedulingType) {
        return this.schedulingType[scheduling] || '';
    }

    onAddReport() {
        this.editReport(new Report(Utils.getGUID(REPORT_PREFIX)), 1);
    }

    onEditReport(report: Report) {
        this.editReport(report, 0);
    }

    onStartReport(report: Report) {
        this.commandService.buildReport(report).subscribe(() => {
        });
    }

    onRemoveReport(report: Report) {
        this.editReport(report, -1);
    }

    editReport(report: Report, toAdd: number) {
        let dlgwidth = (toAdd < 0) ? 'auto' : '80%';
        let reports = this.dataSource.data.filter(s => s.id !== report.id);
		let mreport: Report = JSON.parse(JSON.stringify(report));
        let dialogRef = this.dialog.open(ReportEditorComponent, {
            data: { report: mreport, editmode: toAdd, reports: reports, devices: Object.values(this.projectService.getDevices()) },
            width: dlgwidth,
            position: { top: '80px' }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                if (toAdd < 0) {
                    this.projectService.removeReport(result).subscribe(result => {
                        this.loadReports();
                    });
				} else {
                    this.projectService.setReport(result, report).subscribe(() => {
                        this.loadReports();
                    });
                }
            }
        });
    }

    private loadReports() {
        this.dataSource.data = this.projectService.getReports().sort((a: Report, b: Report) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    }
}
