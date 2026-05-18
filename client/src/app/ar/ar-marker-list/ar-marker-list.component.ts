import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSort } from '@angular/material/sort';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';

import { ArMarker, ArSettings } from '../../_models/ar';
import { SettingsService } from '../../_services/settings.service';
import { ConfirmDialogComponent } from '../../gui-helpers/confirm-dialog/confirm-dialog.component';
import { SectionMessageDialogComponent } from '../../editor/section-message-dialog/section-message-dialog.component';
import { ProjectService } from '../../_services/project.service';
import { ArMarkerPropertyComponent } from '../ar-marker-property/ar-marker-property.component';
import { createQrSvg, createQrSvgDataUrl } from '../ar-marker-property/qr-code-generator';

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
    private sectionMessageHandled = false;
    private sectionMessageOpened = false;

    @ViewChild(MatTable, { static: true }) table: MatTable<ArMarker>;
    @ViewChild(MatSort, { static: false }) sort: MatSort;

    constructor(
        private dialog: MatDialog,
        private translateService: TranslateService,
        private projectService: ProjectService,
        private settingsService: SettingsService
    ) { }

    ngOnInit() {
        this.loadMarkers();
        this.openArMarkersNoticeIfNeeded();
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
        this.downloadSvg(svg, `${this.getMarkerFileName(marker)}.svg`);
    }

    onDownloadAllMarkers() {
        const markers = this.arSettings?.markers || [];
        if (!markers.length) {
            return;
        }

        const cellWidth = 240;
        const cellHeight = 280;
        const qrSize = 180;
        const columns = 3;
        const rows = Math.ceil(markers.length / columns);
        const width = cellWidth * columns;
        const height = cellHeight * rows;
        const items = markers.map((marker, index) => {
            const column = index % columns;
            const row = Math.floor(index / columns);
            const x = column * cellWidth + (cellWidth - qrSize) / 2;
            const y = row * cellHeight + 18;
            const label = this.escapeSvg(marker.label || marker.id);
            const view = this.escapeSvg(this.getViewName(marker.viewId) || '');
            return `
                <image href="${createQrSvgDataUrl(marker.id)}" x="${x}" y="${y}" width="${qrSize}" height="${qrSize}"/>
                <text x="${column * cellWidth + cellWidth / 2}" y="${y + qrSize + 26}" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="600">${label}</text>
                <text x="${column * cellWidth + cellWidth / 2}" y="${y + qrSize + 48}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#555">${view}</text>
                <text x="${column * cellWidth + cellWidth / 2}" y="${y + qrSize + 66}" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#777">${this.escapeSvg(marker.id)}</text>
            `;
        }).join('');
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fff"/>${items}</svg>`;
        this.downloadSvg(svg, 'ar-markers.svg');
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

    private downloadSvg(svg: string, filename: string) {
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }

    private escapeSvg(value: string): string {
        return (value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    private openArMarkersNoticeIfNeeded() {
        if (this.sectionMessageHandled || this.sectionMessageOpened ||
            this.settingsService.getSettings()?.editorSectionMessages?.hideArMarkersNotice) {
            this.sectionMessageHandled = true;
            return;
        }

        this.sectionMessageOpened = true;
        const dialogRef = this.dialog.open(SectionMessageDialogComponent, {
            autoFocus: false,
            width: '560px',
            panelClass: 'light-dialog-container',
            data: {
                titleKey: 'ar.markers-notice-title',
                messageKey: 'ar.markers-notice-message',
                hideLabelKey: 'ar.markers-notice-hide',
                actionLabelKey: 'ar.markers-notice-open',
                routePath: '/ar',
                absoluteUrl: `${window.location.origin}/ar`,
                settingKey: 'hideArMarkersNotice'
            }
        });

        dialogRef.afterClosed().subscribe(() => {
            this.sectionMessageOpened = false;
            this.sectionMessageHandled = true;
        });
    }
}
