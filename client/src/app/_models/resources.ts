export class Resources {
    type: ResourceType;
    groups: ResourceGroup[];
}

export enum ResourceType {
    images = 'images',
    widgets = 'widgets'
}

export class ResourceGroup {
    name: string;
    label?: string;
    items?: ResourceItem[];
}

export class ResourceItem {
    name?: string;
    label?: string;
    path: string;
}
