
export class MapsLocation {
    id: string;
    name: string;
    description: string;

    constructor(_id: string) {
        this.id = _id;
    }
}

export const MAPSLOCATION_PREFIX = 'l_';
