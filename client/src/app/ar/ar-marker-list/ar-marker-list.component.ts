import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSort } from '@angular/material/sort';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';

import { ArMarker, ArSettings } from '../../_models/ar';
import { ConfirmDialogComponent } from '../../gui-helpers/confirm-dialog/confirm-dialog.component';
import { ProjectService } from '../../_services/project.service';
import { ArMarkerPropertyComponent } from '../ar-marker-property/ar-marker-property.component';
import { createQrSvg } from '../ar-marker-property/qr-code-generator';

@Component({
    selector: 'app-ar-marker-list',
    templateUrl: './ar-marker-list.component.html',
    styleUrls: ['./ar-marker-list.component.scss']
})
export class ArMarkerListComponent implements OnInit, AfterViewInit, OnDestroy {
    displayedColumns = ['select', 'id', 'label', 'view', 'ttlMs', 'download', 'remove'];
    dataSource = new MatTableDataSource<ArMarker>([]);
    arSettings: ArSettings;
    viewNameMap: { [key: string]: string } = {};
    private destroy$ = new Subject<void>();

    @ViewChild(MatTable, { static: true }) table: MatTable<ArMarker>;
    @ViewChild(MatSort, { static: false }) sort: MatSort;

    constructor(
        private dialog: MatDialog,
        private translateService: TranslateService,
        private projectService: ProjectService
    ) { }

    ngOnInit() {
        this.loadMarkers();
        this.projectService.onLoadHmi.pipe(
            takeUntil(this.destroy$)
        ).subscribe(_ => this.loadMarkers());
    }

    ngAfterViewInit() {
        this.dataSource.sort = this.sort;
    }

    ngOnDestroy() {
        this.destroy$.next(null);
        this.destroy$.complete();
    }

    onToggleEnabled() {
        this.arSettings.enabled = !this.arSettings.enabled;
        this.projectService.setArSettings(this.arSettings).subscribe(() => this.loadMarkers());
    }

    onAddMarker() {
        this.editMarker();
    }

    onEditMarker(marker: ArMarker) {
        this.editMarker(marker);
    }

    onRemoveMarker(marker: ArMarker) {
        const msg = this.translateService.instant('msg.ar-marker-remove', { value: marker.id });
        const dialogRef = this.dialog.open(ConfirmDialogComponent, {
            data: { msg },
            position: { top: '60px' }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result && marker) {
                this.projectService.removeArMarker(marker).subscribe(() => this.loadMarkers());
            }
        });
    }

    getViewName(viewId: string) {
        return this.viewNameMap[viewId] || viewId;
    }

    onDownloadMarker(marker: ArMarker) {
        const svg = createQrSvg(marker.id);
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${this.getMarkerFileName(marker)}.svg`;
        link.click();
        URL.revokeObjectURL(url);
    }

    private loadMarkers() {
        this.arSettings = this.projectService.getArSettings();
        this.viewNameMap = this.projectService.getViews().reduce((acc, view) => {
            acc[view.id] = view.name;
            return acc;
        }, {} as { [key: string]: string });
        this.dataSource.data = [...(this.arSettings.markers || [])];
    }

    private editMarker(marker?: ArMarker) {
        const dialogRef = this.dialog.open(ArMarkerPropertyComponent, {
            position: { top: '60px' },
            disableClose: true,
            data: {
                marker,
                markerIds: this.projectService.getArMarkers().map(item => item.id)
            }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.projectService.setArMarker(result, marker).subscribe(() => this.loadMarkers());
            }
        });
    }

    private getMarkerFileName(marker: ArMarker): string {
        const label = marker.label || marker.id;
        return `ar-marker-${label}`.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '');
    }
}
