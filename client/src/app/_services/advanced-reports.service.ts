import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AdvancedReport } from '../reports/advanced-report-editor/advanced-report-editor.component';

@Injectable({
    providedIn: 'root'
})
export class AdvancedReportsService {

    constructor(private http: HttpClient) { }

    getAdvancedReports(): Observable<AdvancedReport[]> {
        return this.http.get<AdvancedReport[]>('/api/advanced-reports');
    }

    saveAdvancedReport(report: AdvancedReport): Observable<any> {
        return this.http.post('/api/advanced-reports', report);
    }

    deleteAdvancedReport(id: string): Observable<any> {
        return this.http.delete(`/api/advanced-reports/${id}`);
    }

    generateAdvancedReport(id: string): Observable<any> {
        return this.http.post(`/api/advanced-reports/generate/${id}`, {});
    }

    testGenerateReport(report: AdvancedReport): Observable<any> {
        // Extract template from the correct location (either direct or nested in pdfmeData)
        const template = report.template || (report as any).pdfmeData?.template;
        const reportWithDefaults = {
            ...report,
            template: template,
            saveToDisk: (report as any).saveToDisk !== undefined ? (report as any).saveToDisk : true,
            emailSettings: (report as any).emailSettings || {
                enabled: false,
                subject: 'FUXA Advanced Report',
                message: 'Please find attached the generated report.',
                emails: ['']
            }
        };
        return this.http.post('/api/advanced-reports/test-generate', reportWithDefaults);
    }
}