import { Injectable } from '@angular/core';
import { Observable, Subject, map } from 'rxjs';
import { ResourceGroup, ResourceType } from '../../_models/resources';
import { ResourcesService } from '../../_services/resources.service';

@Injectable({
    providedIn: 'root'
})
export class LibWidgetsService {

    resourceWidgets$: Observable<ResourceGroup[]>;
    clearSelection$ = new Subject<void>();
    svgWidgetSelected$ = new Subject<string>();

    constructor(private resourcesService: ResourcesService) {
        this.resourceWidgets$ = this.resourcesService.getResources(ResourceType.widgets).pipe(
            map(images => images.groups),
        );
    }

    clearSelection() {
        this.clearSelection$.next();
    }

    widgetSelected(widgetPath: string) {
        if (widgetPath.split('.').pop().toLowerCase() === 'svg') {
            this.svgWidgetSelected$.next(widgetPath);
        }
    }
}
