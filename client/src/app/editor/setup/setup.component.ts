import { Component, OnInit, AfterViewInit } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material';
import { Router } from '@angular/router';

import { ProjectService } from '../../_services/project.service';

import { ChartConfigComponent } from '../../editor/chart-config/chart-config.component';
import { LayoutPropertyComponent } from '../../editor/layout-property/layout-property.component';
import { PluginsComponent } from '../../editor/plugins/plugins.component';

@Component({
    selector: 'app-setup',
    templateUrl: './setup.component.html',
    styleUrls: ['./setup.component.scss']
})
export class SetupComponent implements OnInit, AfterViewInit {

    constructor(private router: Router,
        public dialog: MatDialog,
        private projectService: ProjectService,
        public dialogRef: MatDialogRef<SetupComponent>) { }

    ngOnInit() {
    }

    ngAfterViewInit() {
    }

    onNoClick() {
        this.dialogRef.close();
    }

    goTo(destination:string) {
        this.onNoClick();
        this.router.navigate([destination]);
    }

    /**
     * edit the chart configuration
     */
    onChartConfig() {
        this.onNoClick();
        let chartscopy = JSON.parse(JSON.stringify(this.projectService.getCharts()));
        let devices = this.projectService.getDevices();
        let dialogRef = this.dialog.open(ChartConfigComponent, {
            position: { top: '60px' },
            data: { charts: chartscopy, devices: devices }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.projectService.setCharts(result.charts);
            }
        });
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
            data: { layout: templayout, views: hmi.views }
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
}
