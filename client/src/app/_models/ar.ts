export class ArSettings {
    enabled = false;
    markers: ArMarker[] = [];
}

export interface ArMarker {
    id: string;
    label?: string;
    viewId: string;
    ttlMs?: number;
}

export const AR_MARKER_PREFIX = 'ar_';
