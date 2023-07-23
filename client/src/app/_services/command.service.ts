import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { EndPointApi } from '../_helpers/endpointapi';
import { Report } from '../_models/report';
import { RcgiService } from './rcgi/rcgi.service';
import { ResourceStorageService } from './rcgi/resource-storage.service';

@Injectable({
    providedIn: 'root'
})
export class CommandService {

    private endPointConfig: string = EndPointApi.getURL();
	private server: ResourceStorageService;

    constructor(
        private http: HttpClient,
		private rcgiService: RcgiService,
        private translateService: TranslateService,
        private toastr: ToastrService) {

        this.server = rcgiService.rcgi;
    }

    buildReport(report: Report) {
        return new Observable((observer) => {
            if (environment.serverEnabled) {
                let header = new HttpHeaders({ 'Content-Type': 'application/json' });
                let params = { cmd: CommanType.reportBuild, report: report };
                this.http.post<any>(this.endPointConfig + '/api/command', { headers: header, params: params }).subscribe(result => {
                    observer.next();
                    var msg = '';
                    this.translateService.get('msg.report-build-forced').subscribe((txt: string) => { msg = txt; });
                    this.toastr.success(msg);
                }, err => {
                    console.error(err);
                    observer.error(err);
                    this.notifyError(err);
                });
            } else {
                observer.next();
            }
        });
    }

    getReportFile(reportName: string): Observable<Blob> {
        return  this.server.downloadFile(reportName, CommanType.reportDownload);
    }

    private notifyError(err: any) {
        var msg = '';
        this.translateService.get('msg.report-build-error').subscribe((txt: string) => { msg = txt; });
        this.toastr.error(msg, '', {
            timeOut: 3000,
            closeButton: true,
            disableTimeOut: true
        });
    }
}

export enum CommanType {
    reportBuild = 'REPORT-BUILD',
    reportDelete = 'REPORT-DELETE',
    reportDownload = 'REPORT-DOWNLOAD'
};
