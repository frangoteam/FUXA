import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild } from '@angular/core';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { MatDialog } from '@angular/material/dialog';
import { MatSort } from '@angular/material/sort';
import { Subscription } from 'rxjs';

import { ProjectService } from '../../_services/project.service';
import { TranslateService } from '@ngx-translate/core';
import { NotificationPropertyComponent } from '../notification-property/notification-property.component';
import { Notification, NotificationsType, NOTIFY_PREFIX } from '../../_models/notification';
import { AlarmsType } from '../../_models/alarm';
import { Utils } from '../../_helpers/utils';

@Component({
    selector: 'app-notification-list',
    templateUrl: './notification-list.component.html',
    styleUrls: ['./notification-list.component.css']
})
export class NotificationListComponent implements OnInit, AfterViewInit, OnDestroy {

    displayedColumns = ['select', 'name', 'receiver', 'delay', 'interval', 'type', 'enabled', 'subscriptions', 'remove'];
    dataSource = new MatTableDataSource([]);

    notificationAlarm = Object.keys(NotificationsType).find(key => NotificationsType[key] === NotificationsType.alarms);
    notificationTrigger = Object.keys(NotificationsType).find(key => NotificationsType[key] === NotificationsType.trigger);
    alarmsType = {};
    alarmsEnum = AlarmsType;

    private subscriptionLoad: Subscription;

    @ViewChild(MatTable, {static: true}) table: MatTable<any>;
    @ViewChild(MatSort, {static: false}) sort: MatSort;

    constructor(public dialog: MatDialog,
        private translateService: TranslateService,
        private projectService: ProjectService) { }

    ngOnInit() {
        this.loadNotifications();
        this.subscriptionLoad = this.projectService.onLoadHmi.subscribe(res => {
            this.loadNotifications();
        });
        Object.values(this.alarmsEnum).forEach(key => {
            this.translateService.get('alarm.property-' + key).subscribe((txt: string) => { this.alarmsType[key] = txt; });
        });
    }

    ngAfterViewInit() {
        this.dataSource.sort = this.sort;
    }

    ngOnDestroy() {
        try {
            if (this.subscriptionLoad) {
                this.subscriptionLoad.unsubscribe();
            }
        } catch (e) {
        }
    }

    onAddNotification() {
        let notification = new Notification(Utils.getGUID(NOTIFY_PREFIX));
		this.editNotification(notification, 1);
    }

    onEditNotification(notification: Notification) {
		this.editNotification(notification, 0);
    }

    onRemoveNotification(notification: Notification) {
		this.editNotification(notification, -1);
    }

    editNotification(notification: Notification, toAdd: number) {
		let mnotification: Notification = JSON.parse(JSON.stringify(notification));
        let dialogRef = this.dialog.open(NotificationPropertyComponent, {
            data: { notification: mnotification, editmode: toAdd, notifications: this.dataSource.data },
            position: { top: '80px' }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                if (toAdd < 0) {
                    this.projectService.removeNotification(result).subscribe(result => {
                        this.loadNotifications();
                    });
				} else {
                    this.projectService.setNotification(result, notification).subscribe(result => {
                        this.loadNotifications();
                    });
                }
            }
        });
    }

    getSubProperty(notification: Notification) {
        if (notification) {
            if (notification.type === this.notificationAlarm) {
                let result = '';
                Object.keys(notification.subscriptions).forEach(key => {
                    if (notification.subscriptions[key]) {
                        if (result) {result += ', ';}
                        result += this.alarmsType[key];
                    }
                });
                return result;
            }
        }
        return '';
    }

    private loadNotifications() {
        this.dataSource.data = this.projectService.getNotifications();
	}
}
