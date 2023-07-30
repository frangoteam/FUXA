import { Component } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';

import { ProjectService } from '../../_services/project.service';
import { AppService } from '../../_services/app.service';

import { ChartConfigComponent } from '../../editor/chart-config/chart-config.component';
import { GraphConfigComponent } from '../../editor/graph-config/graph-config.component';
import { ILayoutPropertyData, LayoutPropertyComponent } from '../../editor/layout-property/layout-property.component';
import { PluginsComponent } from '../../editor/plugins/plugins.component';
import { AppSettingsComponent } from '../../editor/app-settings/app-settings.component';

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
        public dialogRef: MatDialogRef<SetupComponent>) { }

    onNoClick() {
        this.dialogRef.close();
    }

    goTo(destination: string) {
        this.onNoClick();
        this.router.navigate([destination]);
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
        if (section === 'messages') {
            return this.appService.isClientApp;
        } else if (section === 'users') {
            return this.appService.isClientApp;
        } else if (section === 'plugins') {
            return this.appService.isClientApp;
        } else if (section === 'notifications') {
            return this.appService.isClientApp;
        } else if (section === 'scripts') {
            return this.appService.isClientApp;
        } else if (section === 'reports') {
            return this.appService.isClientApp;
        }
        return false;
    }
}
