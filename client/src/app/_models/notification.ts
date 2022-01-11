
export class Notification {
    id: string;
    name: string;
    receiver: string;
    delay: number = 1;
    interval: number = 0;
    enabled: boolean = true;
    text: string;
    type: string;
    subscriptions = {};
    options: any;

    constructor(_id: string) {
        this.id = _id;
    }    
}

export enum NotificationsType {
    alarms = 'notification.type-alarm',
    trigger = 'notification.type-trigger'
}

export const NOTIFY_PREFIX = 'n_';
