import { AfterViewInit, Component, OnInit } from '@angular/core';
import * as L from 'leaflet';

@Component({
    selector: 'app-maps-view',
    templateUrl: './maps-view.component.html',
    styleUrls: ['./maps-view.component.scss']
})
export class MapsViewComponent implements OnInit, AfterViewInit {

    private map!: L.Map;

    constructor() { }

    ngOnInit() {
    }

    ngAfterViewInit(): void {
        this.map = L.map('map').setView([45.4642, 9.1900], 13); // Milano

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(this.map);
    }
}
