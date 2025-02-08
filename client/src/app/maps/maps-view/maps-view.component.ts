import { AfterViewInit, ApplicationRef, Component, ComponentFactoryResolver, ElementRef, Injector, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import * as L from 'leaflet';
import { GaugesManager } from '../../gauges/gauges.component';
import { FuxaViewComponent } from '../../fuxa-view/fuxa-view.component';
import { ProjectService } from '../../_services/project.service';
import { Hmi, View, ViewProperty } from '../../_models/hmi';
import { Subject, takeUntil } from 'rxjs';
import { MatLegacyMenuTrigger as MatMenuTrigger } from '@angular/material/legacy-menu';
import { MatLegacyDialog as MatDialog} from '@angular/material/legacy-dialog';
import { MapsLocation, MAPSLOCATION_PREFIX } from '../../_models/maps';
import { MapsLocationPropertyComponent } from '../maps-location-property/maps-location-property.component';
import { Utils } from '../../_helpers/utils';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';

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

    @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;
    private map: L.Map | null = null;

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
        private translateService: TranslateService,
        private toastr: ToastrService
    ) { }

    ngOnInit() {
    }

    ngAfterViewInit(): void {
        // const container = L.DomUtil.get('map'); // Controlla se il contenitore esiste
        // if (container) {
        //     container.remove(); // Rimuove il div esistente
        // }
        // this.mapContainer.nativeElement.innerHTML = '';
        let startLocation: L.LatLngExpression = [46.9466746335407, 7.444236656153662]; // Bern
        if (this.view.property?.startLocation) {
            startLocation = [this.view.property.startLocation.latitude, this.view.property.startLocation.longitude];
        }
        this.map = L.map('map').setView(startLocation, 13); // Bern

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

    reload() {
        this.loadMapsResources();
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
        this.locations = this.view?.svgcontent ? this.projectService.getMapsLocations(JSON.parse(this.view.svgcontent)) : [];
        this.clearMarker();
        this.locations.forEach(loc => {
            const marker = L.marker([loc.latitude, loc.longitude])
                            .addTo(this.map);

            marker.bindTooltip(`${loc.name}`, {
                permanent: true,
                direction: 'top',
                // className: "marker-label"
            });
            marker.on('click', () => {
                this.showFuxaViewPopup(loc.latitude, loc.longitude);
            });
        });
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
        const componentRef = factory.create(this.injector);

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

    onAddLocation() {
        let location = new MapsLocation(Utils.getGUID(MAPSLOCATION_PREFIX));
        location.latitude = this.lastClickLatLng.lat;
        location.longitude = this.lastClickLatLng.lng;
        this.editLocation(location);
    }

    onEditLocation() {
        console.log('onEditLocation');
    }

    onRemoveLocation() {
        console.log('onRemoveLocation');
    }

    onSetStartLocation() {
        this.view.property ??= new ViewProperty();
        this.view.property.startLocation = new MapsLocation(Utils.getGUID(MAPSLOCATION_PREFIX));
        this.view.property.startLocation.latitude = this.lastClickLatLng.lat;
        this.view.property.startLocation.longitude = this.lastClickLatLng.lng;
        this.projectService.setViewAsync(this.view).then(() => {
            this.toastr.success(this.translateService.instant('maps.edit-start-location-saved'));
        });
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
                        this.locations.push(location);
                        this.view.svgcontent = JSON.stringify(this.locations.map(loc => loc.id));
                        this.projectService.setViewAsync(this.view).then(() => {
                            this.loadMapsResources();
                        });
                    }
                });
			}
		});
	}
}
