import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Observable, Subject, takeUntil } from 'rxjs';
import { ResourceGroup, ResourceItem } from '../../_models/resources';
import { LibWidgetsService } from './lib-widgets.service';
import { RcgiService } from '../../_services/rcgi/rcgi.service';
import { MatMenuTrigger } from '@angular/material/menu';
import { ToastNotifierService } from '../../_services/toast-notifier.service';

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
    contextMenuWidget: any = null;
    expandedGroups: { [groupName: string]: boolean } = {};

    @ViewChild('menuTriggerButton') menuTrigger!: MatMenuTrigger;
    @ViewChild('menuTriggerEl', { read: ElementRef }) triggerButtonRef!: ElementRef;

    constructor(
        private libWidgetService: LibWidgetsService,
        private toastNotifier: ToastNotifierService,
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
        this.destroy$.next(null);
        this.destroy$.complete();
    }

    onSelect(widgetPath: string) {
        this.selectedWidgetPath = widgetPath;
        this.libWidgetService.widgetSelected(`${this.rootPath}/${widgetPath}`);
    }

    clearSelection() {
        this.selectedWidgetPath = null;
    }

    onRemoveWidget(widget: ResourceItem) {
        this.libWidgetService.removeWidget(widget).subscribe(() => {
            this.libWidgetService.refreshResources();
         }, err => {
            console.error('Remove failed:', err);
            this.toastNotifier.notifyError('msg.file-download-failed', err.message || err);
        });
    }
}
