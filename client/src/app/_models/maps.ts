
export class MapsLocation {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    description?: string;
    viewId?: string;
    pageId?: string;
    url?: string;
    showMarkerName?: boolean;
    showMarkerIcon?: boolean;
    showMarkerValue?: boolean;
    markerIcon?: string;
    markerBackground?: string;
    markerColor?: string;
    markerTagValueId?: string;

    constructor(_id: string) {
        this.id = _id;
    }
}

export const MAPSLOCATION_PREFIX = 'l_';
