import { Injectable } from '@angular/core';
import { ResourcesService } from '../../_services/resources.service';
import { map, Observable } from 'rxjs';
import { ResourceGroup, ResourceType } from '../../_models/resources';
import { HttpClient } from '@angular/common/http';

@Injectable({
    providedIn: 'root'
})
export class KioskWidgetsService {

    resourceWidgets$: Observable<ResourceGroup[]>;

    constructor(
        private http: HttpClient,
        private resourcesService: ResourcesService
    ) {
        this.resourceWidgets$ = this.resourcesService.getResources(ResourceType.widgets).pipe(
            map(images => images.groups),
        );
    }

}
