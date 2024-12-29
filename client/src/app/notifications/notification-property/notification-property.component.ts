import { Component, OnInit, Inject } from '@angular/core';
import { MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';

import { AlarmsType } from '../../_models/alarm';
import { Notification, NotificationsType, NOTIFY_PREFIX } from '../../_models/notification';
import { TranslateService } from '@ngx-translate/core';
import { Utils } from '../../_helpers/utils';
import { AbstractControl, UntypedFormBuilder, UntypedFormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ProjectService } from '../../_services/project.service';

@Component({
    selector: 'app-notification-property',
    templateUrl: './notification-property.component.html',
    styleUrls: ['./notification-property.component.scss']
})
export class NotificationPropertyComponent implements OnInit {

    notification: Notification;
    notificationsType = NotificationsType;
    notificationAlarm = Utils.getEnumKey(NotificationsType, NotificationsType.alarms);
    notificationTrigger = Utils.getEnumKey(NotificationsType, NotificationsType.trigger);
    formGroup: UntypedFormGroup;

    alarmsType = [AlarmsType.HIGH_HIGH, AlarmsType.HIGH, AlarmsType.LOW, AlarmsType.INFO];

    constructor(public dialogRef: MatDialogRef<NotificationPropertyComponent>,
        private fb: UntypedFormBuilder,
        private translateService: TranslateService,
        private projectService: ProjectService,
        @Inject(MAT_DIALOG_DATA) public data: NotificationPropertyData) {
            this.notification = this.data.notification ?? new Notification(Utils.getGUID(NOTIFY_PREFIX));
    }

    ngOnInit() {
        this.formGroup = this.fb.group({
            name: [this.notification.name, Validators.required],
            receiver: [this.notification.receiver, Validators.required],
            type: [this.notification.type, Validators.required],
            delay: [this.notification.delay],
            interval: [this.notification.interval],
            enabled: [this.notification.enabled],
        });
        this.formGroup.controls.name.addValidators(this.isValidName());

        Object.keys(this.notificationsType).forEach(key => {
            this.notificationsType[key] = this.translateService.instant(this.notificationsType[key]);
        });
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.notification = {...this.notification, ...this.formGroup.getRawValue()};
        this.dialogRef.close(this.notification);
    }

    onTypeChanged(type: NotificationsType) {
    }

    onSubscriptionChanged(type: AlarmsType, value: boolean) {
        this.notification.subscriptions[type] = value;
    }

    getTypeValue(type: AlarmsType) {
        if (this.notification?.type === this.notificationAlarm) {
            return this.notification.subscriptions[type];
        }
        return false;
    }

    isValidName(): ValidatorFn {
        const names = this.projectService.getNotifications().map(not => not.name);
        return (control: AbstractControl): ValidationErrors | null => {
            if (this.notification?.name === control.value) {
                return null;
            }
            if (names?.indexOf(control.value) !== -1) {
                return { name: this.translateService.instant('msg.notification-name-exist') };
            }
            return null;
        };
    }
}

export interface NotificationPropertyData {
    notification: Notification;
}

