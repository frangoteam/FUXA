import { Component, OnDestroy, OnInit } from '@angular/core';
import { Observable, Subject, takeUntil } from 'rxjs';
import { ResourceGroup } from '../../_models/resources';
import { LibWidgetsService } from './lib-widgets.service';
import { RcgiService } from '../../_services/rcgi/rcgi.service';

@Component({
    selector: 'app-lib-widgets',
    templateUrl: './lib-widgets.component.html',
    styleUrls: ['./lib-widgets.component.scss']
})
export class LibWidgetsComponent implements OnInit, OnDestroy {

    resourceWidgets$: Observable<ResourceGroup[]>;
    selectedWidgetPath: string;
    private destroy$ = new Subject<void>();
    rootPath = '';

    constructor(
        private libWidgetService: LibWidgetsService,
        private rcgiService: RcgiService) {
            this.rootPath = this.rcgiService.rcgi.endPointConfig;
        }

    ngOnInit() {
        this.resourceWidgets$ = this.libWidgetService.resourceWidgets$;
        this.libWidgetService.clearSelection$.pipe(
            takeUntil(this.destroy$)
        ).subscribe(() => {
            this.clearSelection();
        });
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    onSelect(widgetPath: string) {
        this.selectedWidgetPath = widgetPath;
        this.libWidgetService.widgetSelected(`${this.rootPath}/${widgetPath}`);
    }

    clearSelection() {
        this.selectedWidgetPath = null;
    }
}
