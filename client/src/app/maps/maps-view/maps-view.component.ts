import { AfterViewInit, ApplicationRef, Component, ComponentFactoryResolver, ElementRef, Inject, Injector, Input, OnDestroy, OnInit, ViewChild, ViewContainerRef } from '@angular/core';
import * as L from 'leaflet';
import { GaugesManager } from '../../gauges/gauges.component';
import { FuxaViewComponent } from '../../fuxa-view/fuxa-view.component';
import { ProjectService } from '../../_services/project.service';
import { Hmi } from '../../_models/hmi';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'app-maps-view',
    templateUrl: './maps-view.component.html',
    styleUrls: ['./maps-view.component.scss']
})
export class MapsViewComponent implements OnInit, AfterViewInit, OnDestroy {

    @Input() hmi: Hmi;
    @Input() gaugesManager: GaugesManager;        // gauges.component

    private map!: L.Map;
    private destroy$ = new Subject<void>();

    constructor(
        private resolver: ComponentFactoryResolver,
        private injector: Injector,
        private projectService: ProjectService,
        private appRef: ApplicationRef,
    ) { }

    ngOnInit() {
        this.hmi = this.projectService.getHmi();
        this.projectService.onLoadHmi.pipe(
            takeUntil(this.destroy$),
        ).subscribe(_ => {
            this.hmi = this.projectService.getHmi();
        });
    }

    ngAfterViewInit(): void {
        this.map = L.map('map').setView([45.4642, 9.1900], 13); // Milano

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; FUXA'
        }).addTo(this.map);

        const marker = L.marker([45.4642, 9.1900]).addTo(this.map);

        const locations = [
            { lat: 45.4642, lng: 9.1900 }, // Milano
            { lat: 45.4786, lng: 9.2302 },
            { lat: 45.4500, lng: 9.1800 }
        ];

        locations.forEach(loc => {
            const marker = L.marker([loc.lat, loc.lng]).addTo(this.map);
            marker.on('click', () => {
                this.showFuxaViewPopup(loc.lat, loc.lng);
            });
        });
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
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
}
