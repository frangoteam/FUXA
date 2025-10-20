import { AfterViewInit, ApplicationRef, Component, ComponentFactoryResolver, ElementRef, EventEmitter, Injector, Input, OnDestroy, Output, ViewChild } from '@angular/core';
import * as L from 'leaflet';
import { GaugesManager } from '../../gauges/gauges.component';
import { FuxaViewComponent } from '../../fuxa-view/fuxa-view.component';
import { ProjectService } from '../../_services/project.service';
import { Hmi, View, ViewProperty } from '../../_models/hmi';
import { Subject, takeUntil } from 'rxjs';
import { MatLegacyMenuTrigger as MatMenuTrigger } from '@angular/material/legacy-menu';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { MapsLocation, MAPSLOCATION_PREFIX } from '../../_models/maps';
import { MapsLocationPropertyComponent } from '../maps-location-property/maps-location-property.component';
import { Utils } from '../../_helpers/utils';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { MapsLocationImportComponent } from '../maps-location-import/maps-location-import.component';
import { MapsFabButtonMenuComponent } from './maps-fab-button-menu/maps-fab-button-menu.component';

@Component({
    selector: 'app-maps-view',
    templateUrl: './maps-view.component.html',
    styleUrls: ['./maps-view.component.scss']
})
export class MapsViewComponent implements AfterViewInit, OnDestroy {

    @Input() view: View;
    @Input() hmi: Hmi;
    @Input() gaugesManager: GaugesManager;        // gauges.component
    @Input() editMode: boolean;
    @Output() onGoTo: EventEmitter<string> = new EventEmitter<string>();

    @ViewChild(MatMenuTrigger) menuTrigger!: MatMenuTrigger;
    @ViewChild('menuTrigger', { read: ElementRef }) menuTriggerButton!: ElementRef;

    @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;
    private map: L.Map | null = null;

    private destroy$ = new Subject<void>();
    lastClickLatLng!: L.LatLng;
    lastClickMarker?: L.Marker;

    menuPosition = { x: '0px', y: '0px' };
    private locations: MapsLocation[] = [];
    lastClickMapLocation?: MapsLocation;

    private openPopups = [];
    private currentPopup: L.Popup | null = null;

    constructor(
        private resolver: ComponentFactoryResolver,
        private injector: Injector,
        private dialog: MatDialog,
        private projectService: ProjectService,
        private appRef: ApplicationRef,
        private translateService: TranslateService,
        private toastr: ToastrService
    ) { }

    ngAfterViewInit(): void {
        let startLocation: L.LatLngExpression = [46.9466746335407, 7.444236656153662]; // Bern
        if (this.view.property?.startLocation) {
            startLocation = [this.view.property.startLocation.latitude, this.view.property.startLocation.longitude];
        }

        setTimeout(() => {
            this.map = L.map('map').setView(startLocation, this.view.property?.startZoom || 13);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; FUXA'
            }).addTo(this.map);

            this.loadMapsResources();
            this.projectService.onLoadHmi.pipe(
                takeUntil(this.destroy$),
            ).subscribe(_ => {
                this.loadMapsResources();
            });

            this.initMapEvents();
            this.map.invalidateSize();
        }, 200);
    }

    ngOnDestroy() {
        this.destroy$.next(null);
        this.destroy$.complete();
    }

    reload() {
        this.loadMapsResources();
    }

    initMapEvents() {
        this.map.on('contextmenu', (event: L.LeafletMouseEvent) => {
            this.showContextMenu(event);
        });
        this.map.on('click', () => {
            this.menuTrigger.closeMenu();
        });
    }

    loadMapsResources() {
        this.hmi = this.projectService.getHmi();
        this.locations = this.view?.svgcontent ? this.projectService.getMapsLocations(JSON.parse(this.view.svgcontent)) : [];
        this.clearMarker();
        const newIcon = L.icon({
            iconUrl: 'assets/images/marker-icon.png',
            shadowUrl: 'assets/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 45],
            popupAnchor: [0, -34]
        });
        this.locations.forEach(loc => {
            const marker = L.marker([loc.latitude, loc.longitude])
                .addTo(this.map);
            marker['locationId'] = loc.id;
            this.openMarkerTooltip(marker, loc);
            marker.setIcon(newIcon);
            marker.on('click', () => {
                this.onClickMarker(loc, marker);
            });

            marker.on('contextmenu', (event) => {
                this.showContextMenu(event, marker);
            });
        });
        this.map.on('popupopen', (e) => {
            this.openPopups.push(e.popup);
        });
        this.map.on('popupclose', (e) => {
            const index = this.openPopups.indexOf(e.popup);
            if (index > -1) {
                this.openPopups.splice(index, 1);
            }
            e.popup = null;
        });
    }

    private openMarkerTooltip(marker: L.Marker, location: MapsLocation) {
        marker.bindTooltip(`${location.name}`, {
            permanent: false,
            direction: 'top',
            offset: [2, -35],
            // className: "marker-label"
        });
    }

    closeAllPopups() {
        this.openPopups.forEach(popup => popup.close());
        this.openPopups.length = 0;
    }

    showContextMenu(event: L.LeafletMouseEvent, marker?: L.Marker): void {
        this.lastClickLatLng = event.latlng;
        this.lastClickMarker = marker;
        const mapContainer = this.map.getContainer().getBoundingClientRect();
        const posX = event.originalEvent.clientX - mapContainer.left;
        const posY = event.originalEvent.clientY - mapContainer.top;
        const triggerButton = this.menuTriggerButton.nativeElement;
        triggerButton.style.left = `${posX}px`;
        triggerButton.style.top = `${posY}px`;
        triggerButton.style.position = 'absolute';
        triggerButton.style.display = 'block';
        this.menuTrigger.openMenu();
    }

    onClickMarker(location: MapsLocation, marker: L.Marker) {
        if (this.currentPopup) {
            this.currentPopup.on('remove', () => {
                this.currentPopup = null;
                this.showPopup(location, marker);
            });
            this.map.closePopup(this.currentPopup);
        } else {
            this.showPopup(location, marker);
        }
    }

    showPopup(location: MapsLocation, marker: L.Marker) {
        this.lastClickMapLocation = location;
        if (!this.isToOpenMenu()) {
            this.createCardPopup(location, marker);
        } else {
            this.showFabButton(location, marker);
        }
    }

    showFabButton(location: MapsLocation, marker: L.Marker) {
        const container = document.createElement('div');
        const factory = this.resolver.resolveComponentFactory(MapsFabButtonMenuComponent);
        const componentRef = factory.create(this.injector);
        this.appRef.attachView(componentRef.hostView);
        container.appendChild((componentRef.hostView as any).rootNodes[0]);
        container.style.width = '40px';
        var buttons = [];
        if (location.viewId) {
            buttons.push({
                icon: 'chat_bubble_outline', action: () => {
                    this.map.closePopup(this.currentPopup);
                    this.createCardPopup(location, marker);
                }
            });
        }
        if (location.pageId) {
            buttons.push({
                icon: 'arrow_outward', action: () => {
                    this.map.closePopup(this.currentPopup);
                    this.onGoTo?.emit(location.pageId);
                }
            });
        }
        if (location.url) {
            buttons.push({
                icon: 'open_in_new', action: () => {
                    this.map.closePopup(this.currentPopup);
                    window.open(location.url, '_blank');
                }
            });
        }
        componentRef.instance.buttons = buttons;

        this.currentPopup = L.popup({
            closeButton: false,
            autoClose: false,
            closeOnClick: true,
            offset: L.point(0, 0),
        }).setLatLng([location.latitude, location.longitude])
            .setContent(container)
            .openOn(this.map);
        this.currentPopup.on('remove', () => {
            this.currentPopup = null;
        });
    }

    createCardPopup(location: MapsLocation, marker?: L.Marker) {
        setTimeout(() => {
            let viewIdToBind = 'map' + location?.viewId;
            if (!location?.viewId || document.getElementById(viewIdToBind)) {
                return;
            }
            const container = document.createElement('div');
            const factory = this.resolver.resolveComponentFactory(FuxaViewComponent);
            const componentRef = factory.create(this.injector);

            componentRef.instance.gaugesManager = this.gaugesManager;
            componentRef.instance.hmi = this.hmi;
            componentRef.instance.view = this.hmi.views.find(view => view.id === location.viewId);
            componentRef.instance.child = true;
            container.setAttribute('id', viewIdToBind);
            this.appRef.attachView(componentRef.hostView);
            container.appendChild((componentRef.hostView as any).rootNodes[0]);

            container.style.width = componentRef.instance.view.profile.width + 'px';

            this.currentPopup = L.popup({
                autoClose: false,
                closeOnClick: false,
                offset: L.point(0, -20)
            }).setLatLng([location.latitude, location.longitude])
                .setContent(container)
                .openOn(this.map);
            this.currentPopup.on('remove', () => {
                this.currentPopup = null;
            });
        }, 250);
    }

    onCloseAllPopup() {
        this.closeAllPopups();
    }

    onAddLocation() {
        let location = new MapsLocation(Utils.getGUID(MAPSLOCATION_PREFIX));
        location.latitude = this.lastClickLatLng.lat;
        location.longitude = this.lastClickLatLng.lng;
        this.editLocation(location);
    }

    onEditLocation() {
        var location = this.locations.find(loc => loc.id === this.lastClickMarker['locationId']);
        if (location) {
            this.editLocation(location);
        }
    }

    onRemoveLocation() {
        if (this.lastClickMarker) {
            var locationIndex = this.locations.findIndex(loc => loc.id === this.lastClickMarker['locationId']);
            if (locationIndex !== -1) {
                this.locations.splice(locationIndex, 1);
                this.view.svgcontent = JSON.stringify(this.locations.map(loc => loc.id));
                this.projectService.setViewAsync(this.view).then(() => {
                    this.map.removeLayer(this.lastClickMarker);
                    this.lastClickMarker = null;
                    this.loadMapsResources();
                });
            }
        }
    }

    onSetStartLocation() {
        this.view.property ??= new ViewProperty();
        this.view.property.startLocation = new MapsLocation(Utils.getGUID(MAPSLOCATION_PREFIX));
        this.view.property.startLocation.latitude = this.lastClickLatLng.lat;
        this.view.property.startLocation.longitude = this.lastClickLatLng.lng;
        this.view.property.startZoom = this.map.getZoom();
        this.projectService.setViewAsync(this.view).then(() => {
            this.toastr.success(this.translateService.instant('maps.edit-start-location-saved'));
        });
    }

    onImportLocation() {
        let dialogRef = this.dialog.open(MapsLocationImportComponent, {
            position: { top: '60px' },
            disableClose: true,
            data: this.locations,
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.insertLocations(result);
            }
        });
    }

    isToOpenMenu(): boolean {
        if (!this.lastClickMapLocation) {
            return false;
        }
        const fields = [this.lastClickMapLocation.pageId, this.lastClickMapLocation.url];
        const definedCount = fields.filter(field => field !== undefined && field !== null && field !== '').length;
        return definedCount >= 1;
    }

    private clearMarker() {
        this.map.eachLayer(layer => {
            if (layer instanceof L.Marker) {
                this.map.removeLayer(layer);
            }
        });
    }

    private editLocation(location?: MapsLocation) {
        let dialogRef = this.dialog.open(MapsLocationPropertyComponent, {
            position: { top: '60px' },
            disableClose: true,
            data: location,
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.projectService.setMapsLocation(result, location).subscribe(() => {
                    if (!this.locations.find(loc => loc.id === location.id)) {
                        this.insertLocations(location);
                    } else {
                        this.loadMapsResources();
                    }
                });
            }
        });
    }

    private insertLocations(location: MapsLocation) {
        this.locations.push(location);
        this.view.svgcontent = JSON.stringify(this.locations.map(loc => loc.id));
        this.projectService.setViewAsync(this.view).then(() => {
            this.loadMapsResources();
        });
    }
}
