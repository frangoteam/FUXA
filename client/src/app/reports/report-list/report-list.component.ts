import { animate, state, style, transition, trigger } from '@angular/animations';
import { Router } from '@angular/router';
import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { MatSort } from '@angular/material/sort';
import { MatLegacyTable as MatTable, MatLegacyTableDataSource as MatTableDataSource } from '@angular/material/legacy-table';
import { TranslateService } from '@ngx-translate/core';
import { Subscription, concatMap, timer } from 'rxjs';
import { Utils } from '../../_helpers/utils';
import { Report, ReportSchedulingType, REPORT_PREFIX } from '../../_models/report';
import { CommandService } from '../../_services/command.service';
import { ProjectService } from '../../_services/project.service';
import { ReportEditorComponent, ReportEditorData } from '../report-editor/report-editor.component';
import { ReportTypeSelectorComponent } from '../report-type-selector/report-type-selector.component';
import { AdvancedReportEditorComponent, AdvancedReportEditorData } from '../advanced-report-editor/advanced-report-editor.component';
import * as FileSaver from 'file-saver';
import { ReportsService } from '../../_services/reports.service';
import { AdvancedReportsService } from '../../_services/advanced-reports.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../gui-helpers/confirm-dialog/confirm-dialog.component';

@Component({
    selector: 'app-report-list',
    templateUrl: './report-list.component.html',
    styleUrls: ['./report-list.component.css'],
    animations: [
        trigger('detailExpand', [
          state('collapsed', style({height: '0px', minHeight: '0'})),
          state('expanded', style({height: '*'})),
          transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
        ]),
      ],
})
export class ReportListComponent implements OnInit, AfterViewInit, OnDestroy {

    displayedColumns = ['select', 'name', 'receiver', 'scheduling', 'type', 'expand', 'create', 'remove'];
    dataSource = new MatTableDataSource<any>([]);

    private subscriptionLoad: Subscription;
    private schedulingType = ReportSchedulingType;
    expandedElement: Report | null;
    currentDetails: string[];

    @ViewChild(MatTable, {static: false}) table: MatTable<any>;
    @ViewChild(MatSort, {static: false}) sort: MatSort;

    constructor(public dialog: MatDialog,
        private translateService: TranslateService,
        private projectService: ProjectService,
        private commandService: CommandService,
        private reportsService: ReportsService,
        private advancedReportsService: AdvancedReportsService,
        private router: Router) { }

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
        const dialogRef = this.dialog.open(ReportTypeSelectorComponent, {
            width: '500px',
            position: { top: '100px' }
        });
        dialogRef.afterClosed().subscribe(type => {
            if (type) {
                if (type === 'basic') {
                    this.editReport(new Report(Utils.getGUID(REPORT_PREFIX)), 1);
                } else if (type === 'advanced') {
                    this.editAdvancedReport(null, 1);
                }
            }
        });
    }

    onEditReport(report: any) {
        if (report.type === 'advanced') {
            this.editAdvancedReport(report, 0);
        } else {
            this.editReport(report, 0);
        }
    }

    onStartReport(report: any) {
        if (report.type === 'advanced') {
            // Instead of calling the generate endpoint, call the test-generate endpoint
            // with the report config loaded from the server
            this.advancedReportsService.testGenerateReport(report).subscribe(() => {
                // Optionally reload details or show success message
                this.loadDetails(report);
            });
        } else {
            this.reportsService.buildReport(report).pipe(
                concatMap(() => timer(5000))
            ).subscribe(() => {
                this.loadDetails(report);
            });
        }
    }

    onRemoveReport(report: any) {
        if (report.type === 'advanced') {
            this.removeAdvancedReport(report);
        } else {
            this.editReport(report, -1);
        }
    }

    editReport(report: Report, toAdd: number) {
        let dlgwidth = (toAdd < 0) ? 'auto' : '80%';
		let mreport: Report = JSON.parse(JSON.stringify(report));
        let dialogRef = this.dialog.open(ReportEditorComponent, {
            data: <ReportEditorData> {
                report: mreport,
                editmode: toAdd
            },
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
        const basicReports = this.projectService.getReports().sort((a: Report, b: Report) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
        
        this.advancedReportsService.getAdvancedReports().subscribe(advancedReports => {
            // Add type to basic reports for consistency
            const basicReportsWithType = basicReports.map(report => ({ ...report, type: 'basic' }));
            
            // Combine and sort all reports
            const allReports = [...basicReportsWithType, ...advancedReports].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
            this.dataSource.data = allReports;
        });
    }

    toogleDetails(element: Report) {
        this.expandedElement = this.expandedElement === element ? null : element;
        this.loadDetails(this.expandedElement);
    }

    loadDetails(element: Report) {
        this.currentDetails = [];
        if (element) {
            this.reportsService.getReportsDir(element).subscribe(result => {
                this.currentDetails = result;
            }, err => {
                console.error('loadDetails err: ' + err);
            });
        }
    }

    onDownloadDetail(file: string) {
        this.commandService.getReportFile(file).subscribe(content => {
            let blob = new Blob([content], { type: 'application/pdf' });
            FileSaver.saveAs(blob, file);
        }, err => {
            console.error('Download Report File err:', err);
        });
    }

    editAdvancedReport(report: any, toAdd: number) {
        if (toAdd === 1) {
            // Create new report
            this.router.navigate(['/reports/advanced']);
        } else {
            // Edit existing report
            this.router.navigate(['/reports/advanced', report.id]);
        }
    }

    removeAdvancedReport(report: any) {
        let dialogRef = this.dialog.open(ConfirmDialogComponent, {
            position: { top: '60px' },
            data: <ConfirmDialogData> { msg: this.translateService.instant('msg.report-remove', { value: report.name }) }
        });

        dialogRef.afterClosed().subscribe((result) => {
            if (result) {
                this.advancedReportsService.deleteAdvancedReport(report.id).subscribe(() => {
                    this.loadReports();
                });
            }
        });
    }

    onRemoveFile(file: string, report: Report) {
        let dialogRef = this.dialog.open(ConfirmDialogComponent, {
            position: { top: '60px' },
            data: <ConfirmDialogData> { msg: this.translateService.instant('msg.file-remove', { value: file }) }
        });

        dialogRef.afterClosed().subscribe((result) => {
            if (result) {
                this.reportsService.removeReportFile(file).pipe(
                    concatMap(() => timer(2000))
                ).subscribe(() => {
                    this.loadDetails(report);
                });
            }
        });
    }
}

