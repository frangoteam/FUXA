import { Injectable, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

import { ProjectService } from '../../_services/project.service';

export interface ArVisibleMarker {
    id: string;
    label: string;
    viewId: string;
    ttlMs: number;
    visible: boolean;
    lastSeen: number;
}

export interface ArMarkerVisibilityEvent {
    markerId: string;
    viewId: string;
}

@Injectable()
export class ArViewService implements OnDestroy {
    private readonly markerTtlMs = 3000;
    private readonly markerViewMap = new Map<string, ArVisibleMarker>();
    private loadSubscription: Subscription;

    constructor(private projectService: ProjectService) {
        this.loadMarkerMappings();
        this.loadSubscription = this.projectService.onLoadHmi.subscribe(() => {
            this.loadMarkerMappings(true);
        });
    }

    get visibleMarkers(): ArVisibleMarker[] {
        return Array.from(this.markerViewMap.values()).filter(marker => marker.visible);
    }

    get debugState(): any {
        const views = this.projectService.getHmi()?.views || [];
        const arSettings = this.projectService.getArSettings();
        return {
            arEnabled: arSettings?.enabled ?? false,
            configuredMarkers: arSettings?.markers?.length || 0,
            views: views.map(view => ({
                id: view.id,
                name: view.name,
                type: view.type,
                svgLength: view.svgcontent?.length || 0
            })),
            mappings: Array.from(this.markerViewMap.values()).map(marker => ({
                id: marker.id,
                label: marker.label,
                viewId: marker.viewId,
                ttlMs: marker.ttlMs,
                visible: marker.visible
            })),
            markerIds: Array.from(this.markerViewMap.keys())
        };
    }

    detectMarker(markerId: string): boolean {
        this.loadMarkerMappings();

        const marker = this.markerViewMap.get(this.normalizeMarkerId(markerId));
        if (!marker) {
            return false;
        }

        marker.visible = true;
        marker.lastSeen = Date.now();
        return true;
    }

    getKnownMarkerIds(): string[] {
        this.loadMarkerMappings();
        return Array.from(this.markerViewMap.keys());
    }

    getConfiguredMarkerCount(): number {
        const arSettings = this.projectService.getArSettings();
        return arSettings?.markers?.filter(marker => marker.id && marker.viewId).length || 0;
    }

    refreshProjectMapping(): void {
        this.projectService.onRefreshProject();
        this.loadMarkerMappings(true);
    }

    updateMarkerVisibility(): ArMarkerVisibilityEvent[] {
        const now = Date.now();
        const removedMarkers: ArMarkerVisibilityEvent[] = [];

        this.markerViewMap.forEach(marker => {
            if (marker.visible && now - marker.lastSeen > marker.ttlMs) {
                marker.visible = false;
                removedMarkers.push({
                    markerId: marker.id,
                    viewId: marker.viewId
                });
            }
        });

        return removedMarkers;
    }

    clear(): void {
        this.markerViewMap.forEach(marker => {
            marker.visible = false;
            marker.lastSeen = 0;
        });
    }

    ngOnDestroy(): void {
        this.clear();
        if (this.loadSubscription) {
            this.loadSubscription.unsubscribe();
        }
    }

    private loadMarkerMappings(force = false): void {
        if (this.markerViewMap.size && !force) {
            return;
        }

        const arSettings = this.projectService.getArSettings();
        const markers = arSettings?.markers?.filter(marker => marker.id && marker.viewId) || [];

        if (!markers.length) {
            this.markerViewMap.clear();
            return;
        }

        const nextMarkerViewMap = new Map<string, ArVisibleMarker>();
        markers.forEach(marker => {
            const markerId = this.normalizeMarkerId(marker.id);
            const previous = this.markerViewMap.get(markerId);
            const view = this.projectService.getViewFromId(marker.viewId);
            nextMarkerViewMap.set(markerId, {
                id: markerId,
                label: marker.label || view?.name || marker.id,
                viewId: marker.viewId,
                ttlMs: marker.ttlMs || this.markerTtlMs,
                visible: previous?.visible ?? false,
                lastSeen: previous?.lastSeen ?? 0
            });
        });
        this.markerViewMap.clear();
        nextMarkerViewMap.forEach((marker, markerId) => this.markerViewMap.set(markerId, marker));
    }

    private normalizeMarkerId(markerId: string): string {
        return (markerId || '').trim();
    }
}
