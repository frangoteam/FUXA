import { Injectable } from '@angular/core';
import { EndPointApi } from '../_helpers/endpointapi';
import { ResourceStorageService } from './rcgi/resource-storage.service';
import { RcgiService } from './rcgi/rcgi.service';
import { Observable } from 'rxjs';
import { Report, ReportFile, ReportsQuery } from '../_models/report';

@Injectable({
    providedIn: 'root'
})
export class ReportsService {

    private endPointConfig: string = EndPointApi.getURL();
    private server: ResourceStorageService;

    constructor(
		private rcgiService: RcgiService,
    ) {
        this.server = rcgiService.rcgi;
    }

    getReportsDir(report: Report): Observable<string[]> {
        return  this.server.getReportsDir(report);
    }

    getReportsQuery(query: ReportsQuery): Observable<ReportFile[]> {
        return  this.server.getReportsQuery(query);
    }

    buildReport(report: Report): Observable<void> {
        return  this.server.buildReport(report);
    }

    removeReportFile(fileName: string): Observable<void> {
        return  this.server.removeReportFile(fileName);
    }
}
