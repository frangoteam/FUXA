import { Component, OnInit, Inject } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { TranslateService } from '@ngx-translate/core';
import { ProjectService } from '../../_services/project.service';
import { PluginService } from '../../_services/plugin.service';

import { Plugin } from '../../_models/plugin';

@Component({
    selector: 'app-plugins',
    templateUrl: './plugins.component.html',
    styleUrls: ['./plugins.component.css']
})
export class PluginsComponent implements OnInit {

    plugins: Plugin[] = [];
    installing: string;
    removing: string;
    installed: string;
    removed: string;
    error: string;

    constructor(@Inject(MAT_DIALOG_DATA) public data: any,
        public dialog: MatDialog,
        public dialogRef: MatDialogRef<PluginsComponent>,
        private translateService: TranslateService,
        private pluginService: PluginService,
        private projectService: ProjectService) { }

    ngOnInit() {
        this.translateService.get('dlg.plugins-status-installing').subscribe((txt: string) => { this.installing = txt; });
        this.translateService.get('dlg.plugins-status-removing').subscribe((txt: string) => { this.removing = txt; });
        this.translateService.get('dlg.plugins-status-installed').subscribe((txt: string) => { this.installed = txt; });
        this.translateService.get('dlg.plugins-status-removed').subscribe((txt: string) => { this.removed = txt; });
        this.translateService.get('dlg.plugins-status-error').subscribe((txt: string) => { this.error = txt; });

        this.pluginService.getPlugins().subscribe(plugins => {
            this.plugins = plugins;
        }, error => {
            console.error('Error getPlugin');
        });
    }

    onNoClick() {
		this.dialogRef.close();
    }

    install(plugin: Plugin) {
        plugin.status = this.installing;
        plugin['working'] = true;
        let pg: Plugin = JSON.parse(JSON.stringify(plugin));
        pg.pkg = true;
        this.pluginService.installPlugin(pg).subscribe(plugins => {
            plugin.status = this.installed;
            plugin.current = plugin.version;
            plugin['working'] = false;
        }, error => {
            plugin.status = this.error + error;
            plugin['working'] = false;
        });
    }

    remove(plugin: Plugin) {
        plugin.status = this.removing;
            plugin['working'] = true;
            this.pluginService.removePlugin(plugin).subscribe(plugins => {
            plugin.status = this.removed;
            plugin.current = '';
            plugin['working'] = false;
        }, error => {
            plugin.status = this.error + error;
            plugin['working'] = false;
        });
    }
}
