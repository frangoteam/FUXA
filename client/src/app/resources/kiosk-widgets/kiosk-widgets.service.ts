import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { WidgetsResource } from '../../_models/resources';
import { MyFileService, TransferResult } from '../../_services/my-file.service';

@Injectable({
    providedIn: 'root'
})
export class KioskWidgetsService {

    endPointWidgetResources = 'https://frangoteam.org/api/list-widgets.php';
    resourceWidgets$: Observable<WidgetsResource[]>;
    widgetAssetBaseUrl = 'https://frangoteam.org/widgets/';

    constructor(
        private http: HttpClient,
        private fileService: MyFileService
    ) {
        this.resourceWidgets$ = this.getWidgetsResource();
    }

    getWidgetsResource(): Observable<WidgetsResource[]> {
        const headers = new HttpHeaders({ 'Skip-Auth': 'true' });
        return this.http.get<WidgetsResource[]>(this.endPointWidgetResources, { headers: headers });
    }

    getWidgetsGroupContent(path: string): Observable<WidgetsResource[]> {
        const headers = new HttpHeaders({ 'Skip-Auth': 'true' });
        return this.http.get<WidgetsResource[]>(
            `${this.endPointWidgetResources}?path=${encodeURIComponent(path)}`, { headers });
    }

    uploadWidgetFromUrl(fullUrl: string, filePath: string, filename?: string): Observable<TransferResult> {
        return new Observable<TransferResult>(observer => {
            fetch(fullUrl)
                .then(res => {
                    if (!res.ok) {
                        throw new Error('Download failed');
                    }
                    return res.text();
                })
                .then(svgText => {
                    const name = filename || filePath.split('/').pop() || fullUrl.split('/').pop() || 'widget.svg';
                    const blob = new Blob([svgText], { type: 'image/svg+xml' });
                    const file = new File([blob], name, { type: 'image/svg+xml' });
                    this.fileService.upload(file, 'widgets', filePath).subscribe({
                        next: result => observer.next(result),
                        error: err => observer.error(err),
                        complete: () => observer.complete()
                    });
                })
                .catch(err => observer.error(err));
        });
    }
}
