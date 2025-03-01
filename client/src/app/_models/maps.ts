
export class MapsLocation {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    description?: string;
    viewId?: string;
    pageId?: string;
    url?: string;

    constructor(_id: string) {
        this.id = _id;
    }
}

export const MAPSLOCATION_PREFIX = 'l_';
