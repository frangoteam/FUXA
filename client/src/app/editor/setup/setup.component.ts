import { Component } from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';
import { MatLegacyDialog as MatDialog, MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';

import { ProjectService } from '../../_services/project.service';
import { AppService } from '../../_services/app.service';

import { ChartConfigComponent } from '../../editor/chart-config/chart-config.component';
import { GraphConfigComponent } from '../../editor/graph-config/graph-config.component';
import { ILayoutPropertyData, LayoutPropertyComponent } from '../../editor/layout-property/layout-property.component';
import { PluginsComponent } from '../../editor/plugins/plugins.component';
import { AppSettingsComponent } from '../../editor/app-settings/app-settings.component';
import { ClientScriptAccessComponent } from '../client-script-access/client-script-access.component';

const clientOnlyToDisable = ['messages', 'users', 'userRoles', 'plugins', 'notifications', 'scripts', 'reports', 'materials', 'logs', 'events', 'language'];

@Component({
    selector: 'app-setup',
    templateUrl: './setup.component.html',
    styleUrls: ['./setup.component.scss']
})
export class SetupComponent {

    constructor(private router: Router,
                private appService: AppService,
                public dialog: MatDialog,
                private projectService: ProjectService,
                public dialogRef: MatDialogRef<SetupComponent>) {

        this.router.routeReuseStrategy.shouldReuseRoute = function() { return false; };
    }

    onNoClick() {
        this.dialogRef.close();
    }

    goTo(destination: string, type?: string) {
        this.onNoClick();
        let navigationExtras: NavigationExtras = {
            queryParams: { type: type }
        };
        this.router.navigate([destination], navigationExtras);
    }

    /**
     * edit the chart configuration
     */
    onChartConfig() {
        this.onNoClick();
        let dialogRef = this.dialog.open(ChartConfigComponent, {
            position: { top: '60px' },
            minWidth: '1090px', width: '1090px'
        });
        dialogRef.afterClosed().subscribe();
    }

    /**
     * edit the graph configuration, bar and pie
     * @param type
     */
    onGraphConfig(type: string) {
        this.onNoClick();
        let dialogRef = this.dialog.open(GraphConfigComponent, {
            position: { top: '60px' },
            minWidth: '1090px', width: '1090px',
            data: { type: type }
        });
        dialogRef.afterClosed().subscribe();
    }

    /**
     * edit the layout property of views: menu, header
     */
    onLayoutConfig() {
        this.onNoClick();
        let templayout = null;
        let hmi = this.projectService.getHmi();
        if (hmi.layout) {
            templayout = JSON.parse(JSON.stringify(hmi.layout));
        }
        if (templayout && templayout.showdev !== false) {
            templayout.showdev = true;
        }
        let dialogRef = this.dialog.open(LayoutPropertyComponent, {
            position: { top: '60px' },
            data: <ILayoutPropertyData>{ layout: templayout, views: hmi.views, securityEnabled: this.projectService.isSecurityEnabled() }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                hmi.layout = JSON.parse(JSON.stringify(result.layout));
                this.projectService.setLayout(hmi.layout);
            }
        });
    }

    /**
     * edit the plugins to install or remove
     */
    onPlugins() {
        this.onNoClick();
        let dialogRef = this.dialog.open(PluginsComponent, {
            position: { top: '60px' },
        });
        dialogRef.afterClosed().subscribe(result => {
        });
    }

    /**
     * edit application settings
     */
    onSettings() {
        this.onNoClick();
        let dialogRef = this.dialog.open(AppSettingsComponent, {
            position: { top: '60px' },
        });
        dialogRef.afterClosed().subscribe(result => {
        });
    }

    isToDisable(section: string) {
        if (clientOnlyToDisable.indexOf(section) !== -1) {
            return this.appService.isClientApp;
        }
        return false;
    }

    onWidgets() {
        this.onNoClick();
        let dialogRef = this.dialog.open(ClientScriptAccessComponent, {
            position: { top: '60px' },
        });
        dialogRef.afterClosed().subscribe(result => {
        });
    }
}
