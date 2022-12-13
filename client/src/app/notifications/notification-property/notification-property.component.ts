import { Component, OnInit, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { AlarmsType } from '../../_models/alarm';
import { Notification, NotificationsType } from '../../_models/notification';
import { TranslateService } from '@ngx-translate/core';
import { Utils } from '../../_helpers/utils';

@Component({
    selector: 'app-notification-property',
    templateUrl: './notification-property.component.html',
    styleUrls: ['./notification-property.component.css']
})
export class NotificationPropertyComponent implements OnInit {

    notification: Notification;
    notificationsType = NotificationsType;
    notificationAlarm = Utils.getEnumKey(NotificationsType, NotificationsType.alarms);
    notificationTrigger = Utils.getEnumKey(NotificationsType, NotificationsType.trigger);

    alarmsType = [AlarmsType.HIGH_HIGH, AlarmsType.HIGH, AlarmsType.LOW, AlarmsType.INFO];

    errorMissingValue = false;

    constructor(public dialogRef: MatDialogRef<NotificationPropertyComponent>,
        private translateService: TranslateService,
        @Inject(MAT_DIALOG_DATA) public data: any) {
            this.notification = this.data.notification;
    }

    ngOnInit() {
        Object.keys(this.notificationsType).forEach(key => {
            this.translateService.get(this.notificationsType[key]).subscribe((txt: string) => { this.notificationsType[key] = txt; });
        });
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        if (this.data.editmode < 0) {
            this.dialogRef.close(this.notification);
        } else if (this.checkValid()) {
            this.dialogRef.close(this.notification);
        }
    }

    checkValid() {
        this.errorMissingValue = !this.notification.name || !this.notification.receiver || !this.notification.type;
        return !(this.errorMissingValue);
    }

    onTypeChanged(type: NotificationsType) {
    }

    onSubscriptionChanged(type: AlarmsType, value: boolean) {
        this.notification.subscriptions[type] = value;
    }

    getTypeValue(type: AlarmsType) {
        if (this.notification.type === this.notificationAlarm) {
            return this.notification.subscriptions[type];
        }
        return false;
    }
}
