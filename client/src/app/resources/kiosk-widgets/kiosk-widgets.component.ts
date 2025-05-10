import { Component, OnInit } from '@angular/core';
import { MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { KioskWidgetsService } from './kiosk-widgets.service';
import { map, Observable } from 'rxjs';
import { ResourceItem, Resources, ResourceType, WidgetsResource } from '../../_models/resources';
import { ResourcesService } from '../../_services/resources.service';
import { TransferResult } from '../../_services/my-file.service';
import { ToastNotifierService } from '../../_services/toast-notifier.service';

@Component({
    selector: 'app-kiosk-widgets',
    templateUrl: './kiosk-widgets.component.html',
    styleUrls: ['./kiosk-widgets.component.scss']
})
export class KioskWidgetsComponent implements OnInit {

    resourceWidgets$: Observable<WidgetsResource[]>;
    groupContent: { [path: string]: WidgetsResource[] } = {};
    loadingGroups: { [path: string]: boolean } = {};
    existingWidgets: string[] = [];
    assetBaseUrl: string;
    changed = false;

    constructor(
        public dialogRef: MatDialogRef<KioskWidgetsComponent>,
        private resourcesService: ResourcesService,
        private toastNotifier: ToastNotifierService,
        private kioskWidgetService: KioskWidgetsService,
    ) {
        this.assetBaseUrl = this.kioskWidgetService.widgetAssetBaseUrl;
    }

    ngOnInit() {
        this.resourceWidgets$ = this.kioskWidgetService.resourceWidgets$;
        this.resourcesService.getResources(ResourceType.widgets).pipe(
            map((res: Resources) =>
                res.groups
                    .reduce((acc: ResourceItem[], group) => acc.concat(group.items || []), [])
                    .map(item => item.name)
                    .filter(name => !!name)
            )
        ).subscribe(items => {
            this.existingWidgets = items;
        });
    }

    onGroupExpand(groupPath: string): void {
        if (!this.groupContent[groupPath]) {
            this.loadingGroups[groupPath] = true;
            this.kioskWidgetService.getWidgetsGroupContent(groupPath).subscribe(res => {
                const enrichedItems = res.map(item => ({
                    ...item,
                    exist: this.existingWidgets.includes(item.name || '')
                }));
                this.groupContent[groupPath] = enrichedItems;
                this.loadingGroups[groupPath] = false;
            }, err => {
                console.error('Load Widgets resources error: ', err);
                this.loadingGroups[groupPath] = false;
            });
        }
    }

    onDownload(item: WidgetItemType) {
        const fileUrl = this.assetBaseUrl + item.path;
        const fileName = item.name || item.path.split('/').pop();

        this.kioskWidgetService.uploadWidgetFromUrl(fileUrl, item.path, fileName).subscribe({
            next: (result: TransferResult) => {
                if (!result.result && result.error) {
                    console.error(result.error);
                    this.toastNotifier.notifyError('msg.file-upload-failed', result.error);
                } else {
                    item.exist = true;
                    this.changed = true;
                }
            },
            error: err => {
                console.error('Download or upload failed:', err);
                this.toastNotifier.notifyError('msg.file-download-failed', err.message || err);
            }
        });
    }

    onNoClick(): void {
        this.dialogRef.close(this.changed);
    }

    onOkClick(): void {
        this.dialogRef.close(this.changed);
    }
}

interface WidgetItemType extends ResourceItem {
    exist?: boolean;
}
