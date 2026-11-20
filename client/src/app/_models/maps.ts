import { GaugeAction } from './hmi';

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
    markerImage?: string;
    markerBackground?: string;
    markerColor?: string;
    markerTagValueId?: string;
    actions?: GaugeAction[];
    /** Placeholder -> tag mapping applied to the card view (viewId) opened from this location */
    variablesMapping?: any[];
    constructor(_id: string) {
        this.id = _id;
    }
}

export const MAPSLOCATION_PREFIX = 'l_';
