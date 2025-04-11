import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { WidgetsResource } from '../../_models/resources';

@Injectable({
    providedIn: 'root'
})
export class KioskWidgetsService {

    endPointWidgetResources = 'https://frangoteam.org/api/list-widgets.php';
    resourceWidgets$: Observable<WidgetsResource[]>;
    widgetAssetBaseUrl = 'https://frangoteam.org/widgets/';

    constructor(
        private http: HttpClient,
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
}
