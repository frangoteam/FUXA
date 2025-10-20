import { Injectable } from '@angular/core';
import { Observable, Subject, map, startWith, switchMap } from 'rxjs';
import { ResourceGroup, ResourceItem, ResourceType } from '../../_models/resources';
import { ResourcesService } from '../../_services/resources.service';

@Injectable({
    providedIn: 'root'
})
export class LibWidgetsService {

    clearSelection$ = new Subject<void>();
    svgWidgetSelected$ = new Subject<string>();
    private refreshSubject = new Subject<void>();

    constructor(
        private resourcesService: ResourcesService) {
    }

    public resourceWidgets$: Observable<ResourceGroup[]> = this.refreshSubject.pipe(
        startWith(0),
        switchMap(() =>
            this.resourcesService.getResources(ResourceType.widgets).pipe(
                map(images => images.groups)
            )
        )
    );

    clearSelection() {
        this.clearSelection$.next(null);
    }

    widgetSelected(widgetPath: string) {
        if (widgetPath.split('.').pop().toLowerCase() === 'svg') {
            this.svgWidgetSelected$.next(widgetPath);
        }
    }

    refreshResources(): void {
        this.refreshSubject.next(null);
    }

    removeWidget(widget: ResourceItem) {
        return this.resourcesService.removeWidget(widget);
    }
}
