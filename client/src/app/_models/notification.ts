
export class Notification {
    id: string;
    name: string;
    receiver: string;
    delay = 1;
    interval = 0;
    enabled = true;
    text: string;
    type: string;
    subscriptions = {};
    options: any;
    mode: NotificationMode = NotificationMode.all;

    constructor(_id: string) {
        this.id = _id;
    }
}

export enum NotificationMode {
    all = 0,
    single = 1
}

export enum NotificationsType {
    alarms = 'notification.type-alarm',
    trigger = 'notification.type-trigger'
}

export const NOTIFY_PREFIX = 'n_';
