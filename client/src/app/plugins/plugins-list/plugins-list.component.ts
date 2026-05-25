import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { ProjectService } from '../../_services/project.service';
import { PluginService } from '../../_services/plugin.service';
import { Plugin, PluginGroupType, PluginType } from '../../_models/plugin';

interface PluginViewModel extends Plugin {
    working?: boolean;
}

@Component({
    selector: 'app-plugins-list',
    templateUrl: './plugins-list.component.html',
    styleUrls: ['./plugins-list.component.scss']
})
export class PluginsListComponent implements OnInit, OnDestroy {

    plugins: PluginViewModel[] = [];
    installing: string;
    removing: string;
    installed: string;
    removed: string;
    error: string;

    private destroy$ = new Subject<void>();

    constructor(
        private translateService: TranslateService,
        private projectService: ProjectService,
        private pluginService: PluginService
    ) { }

    ngOnInit() {
        this.translateService.get('dlg.plugins-status-installing').subscribe((txt: string) => this.installing = txt);
        this.translateService.get('dlg.plugins-status-removing').subscribe((txt: string) => this.removing = txt);
        this.translateService.get('dlg.plugins-status-installed').subscribe((txt: string) => this.installed = txt);
        this.translateService.get('dlg.plugins-status-removed').subscribe((txt: string) => this.removed = txt);
        this.translateService.get('dlg.plugins-status-error').subscribe((txt: string) => this.error = txt);

        this.loadPlugins();

        this.projectService.onLoadHmi.pipe(
            takeUntil(this.destroy$)
        ).subscribe(_ => this.loadPlugins());

        this.pluginService.onPluginsChanged.pipe(
            takeUntil(this.destroy$)
        ).subscribe(_ => this.loadPlugins());
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    install(plugin: PluginViewModel) {
        plugin.status = this.installing;
        plugin.working = true;

        const payload: Plugin = JSON.parse(JSON.stringify(plugin));
        payload.pkg = true;

        this.pluginService.installPlugin(payload).subscribe(() => {
            plugin.status = this.installed;
            plugin.current = plugin.version;
            plugin.working = false;
        }, error => {
            plugin.status = this.error + error;
            plugin.working = false;
        });
    }

    remove(plugin: PluginViewModel) {
        plugin.status = this.removing;
        plugin.working = true;

        this.pluginService.removePlugin(plugin).subscribe(() => {
            plugin.status = this.removed;
            plugin.current = '';
            plugin.working = false;
        }, error => {
            plugin.status = this.error + error;
            plugin.working = false;
        });
    }

    isInstalled(plugin: PluginViewModel) {
        return !!plugin.current?.length;
    }

    isInstallDisabled(plugin: PluginViewModel) {
        return plugin.working || this.isInstalled(plugin) || !plugin.dinamic;
    }

    isRemoveDisabled(plugin: PluginViewModel) {
        return plugin.working || !plugin.canRemove || !this.isInstalled(plugin);
    }

    getPluginIcon(plugin: PluginViewModel) {
        switch (plugin.type) {
        case PluginType.OPCUA:
        case PluginType.BACnet:
        case PluginType.Modbus:
        case PluginType.Raspberry:
        case PluginType.SiemensS7:
        case PluginType.EthernetIP:
        case PluginType.MELSEC:
            return 'settings_input_component';
        case PluginType.REDIS:
            return 'storage';
        case PluginGroupType.Chart:
            return 'insert_chart';
        case PluginGroupType.Service:
            return 'miscellaneous_services';
        default:
            return 'extension';
        }
    }

    private loadPlugins() {
        this.pluginService.getPlugins().subscribe(plugins => {
            this.plugins = [...plugins].sort((a, b) => this.sortPlugins(a, b));
        }, error => {
            console.error('Error getPlugins', error);
        });
    }

    private sortPlugins(a: PluginViewModel, b: PluginViewModel) {
        if (!!a.dinamic !== !!b.dinamic) {
            return a.dinamic ? -1 : 1;
        }
        return `${a.group}-${a.name}`.localeCompare(`${b.group}-${b.name}`);
    }
}
