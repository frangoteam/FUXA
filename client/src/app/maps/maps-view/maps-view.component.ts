import { AfterViewInit, ApplicationRef, Component, ComponentFactoryResolver, ElementRef, Injector, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import * as L from 'leaflet';
import { GaugesManager } from '../../gauges/gauges.component';
import { FuxaViewComponent } from '../../fuxa-view/fuxa-view.component';
import { ProjectService } from '../../_services/project.service';
import { Hmi, View } from '../../_models/hmi';
import { Subject, takeUntil } from 'rxjs';
import { MatLegacyMenuTrigger as MatMenuTrigger } from '@angular/material/legacy-menu';
import { MatLegacyDialog as MatDialog} from '@angular/material/legacy-dialog';
import { MapsLocation, MAPSLOCATION_PREFIX } from '../../_models/maps';
import { MapsLocationPropertyComponent } from '../maps-location-property/maps-location-property.component';
import { Utils } from '../../_helpers/utils';

@Component({
    selector: 'app-maps-view',
    templateUrl: './maps-view.component.html',
    styleUrls: ['./maps-view.component.scss']
})
export class MapsViewComponent implements OnInit, AfterViewInit, OnDestroy {

    @Input() view: View;
    @Input() hmi: Hmi;
    @Input() gaugesManager: GaugesManager;        // gauges.component
    @Input() editMode: boolean;
    @ViewChild(MatMenuTrigger) menuTrigger!: MatMenuTrigger;
    @ViewChild('menuTrigger', { read: ElementRef }) menuTriggerButton!: ElementRef;

    private map!: L.Map;
    private destroy$ = new Subject<void>();
    lastClickLatLng!: L.LatLng;
    menuPosition = { x: '0px', y: '0px' };
    private locations: MapsLocation[] = [];

    constructor(
        private resolver: ComponentFactoryResolver,
        private injector: Injector,
        private dialog: MatDialog,
        private projectService: ProjectService,
        private appRef: ApplicationRef,
    ) { }

    ngOnInit() {
    }

    ngAfterViewInit(): void {
        this.map = L.map('map').setView([45.4642, 9.1900], 13); // Milano

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; FUXA'
        }).addTo(this.map);

        this.loadMapsResources();
        this.projectService.onLoadHmi.pipe(
            takeUntil(this.destroy$),
        ).subscribe(_ => {
            this.loadMapsResources();
        });

        if (this.editMode) {
            this.initEditMode();
        }

        // const locations = [
        //     { lat: 45.4642, lng: 9.1900 }, // Milano
        //     { lat: 45.4786, lng: 9.2302 },
        //     { lat: 45.4500, lng: 9.1800 }
        // ];

        // locations.forEach(loc => {
        //     const marker = L.marker([loc.lat, loc.lng]).addTo(this.map);
        //     marker.on('click', () => {
        //         this.showFuxaViewPopup(loc.lat, loc.lng);
        //     });
        // });


    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    initEditMode() {
        this.map.on('contextmenu', (event: L.LeafletMouseEvent) => {
            this.showContextMenu(event);
        });
        this.map.on('click', () => {
            this.menuTrigger.closeMenu();
        });
    }

    loadMapsResources() {
        this.hmi = this.projectService.getHmi();
        this.locations = this.projectService.getMapsLocations(JSON.parse(this.view.svgcontent ?? '[]'));
    }

    showContextMenu(event: L.LeafletMouseEvent): void {
        this.lastClickLatLng = event.latlng;

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

    showFuxaViewPopup(lat: number, lng: number) {
        const container = document.createElement('div');
        container.className = 'popup-container';

        const factory = this.resolver.resolveComponentFactory(FuxaViewComponent);
        // const componentRef = viewContainerRef.createComponent(factory);
        const componentRef = factory.create(this.injector);
        // componentRef.changeDetectorRef.detectChanges();

        componentRef.instance.gaugesManager = this.gaugesManager;
        componentRef.instance.hmi = this.hmi;
        componentRef.instance.view = this.hmi.views.find(view => view.name === 'Dlg');

        this.appRef.attachView(componentRef.hostView);
        container.appendChild((componentRef.hostView as any).rootNodes[0]);

        container.style.width = componentRef.instance.view.profile.width + 'px';
        container.style.minWidth = '450px';
        container.style.backgroundColor = 'white';

        L.popup()
            .setLatLng([lat, lng])
            .setContent(container)
            .openOn(this.map);
    }

    addLocation() {
        let location = new MapsLocation(Utils.getGUID(MAPSLOCATION_PREFIX));
        location.latitude = this.lastClickLatLng.lat;
        location.longitude = this.lastClickLatLng.lng;
        this.editLocation(location);
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
                        this.locations.push(location);
                        this.view.svgcontent = JSON.stringify(this.locations);
                        this.projectService.setViewAsync(this.view).then(() => {
                            this.loadMapsResources();
                        });
                    }
                });
			}
		});
	}
}
