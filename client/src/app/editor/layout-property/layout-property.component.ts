/* eslint-disable @angular-eslint/component-class-suffix */
import { Component, OnInit, Inject, ViewChild, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { MatLegacyDialog as MatDialog, MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';
import { TranslateService } from '@ngx-translate/core';

import { ProjectService } from '../../_services/project.service';

import { LayoutSettings, NaviModeType, NaviItem, NaviItemType, NotificationModeType, ZoomModeType, InputModeType, HeaderBarModeType, View, HeaderItem, AnchorType, GaugeProperty, LoginInfoType, LoginOverlayColorType, LanguageShowModeType } from '../../_models/hmi';
import { Define } from '../../_helpers/define';
import { Utils } from '../../_helpers/utils';
import { ResourceGroup, ResourceItem, Resources, ResourceType } from '../../_models/resources';
import { ResourcesService } from '../../_services/resources.service';
import { interval, Subject, takeUntil } from 'rxjs';
import { GaugeDialogType, GaugePropertyComponent } from '../../gauges/gauge-property/gauge-property.component';
import { HtmlButtonComponent } from '../../gauges/controls/html-button/html-button.component';
import { CodemirrorComponent } from '@ctrl/ngx-codemirror';
import { MatTabChangeEvent } from '@angular/material/tabs';
import 'codemirror/mode/css/css';
import { LayoutMenuItemPropertyComponent } from './layout-menu-item-property/layout-menu-item-property.component';
import { LayoutHeaderItemPropertyComponent } from './layout-header-item-property/layout-header-item-property.component';

@Component({
    selector: 'app-layout-property',
    templateUrl: './layout-property.component.html',
    styleUrls: ['./layout-property.component.scss']
})
export class LayoutPropertyComponent implements OnInit, OnDestroy {

    draggableListLeft = [];
    headerItems: HeaderItem[];
    layout: LayoutSettings;
    defaultColor = Utils.defaultColor;
    fonts = Define.fonts;
    anchorType = <AnchorType[]>['left', 'center', 'right'];
    loginInfoType = <LoginInfoType[]>['nothing', 'username', 'fullname', 'both'];
    languageShowModeType = <LanguageShowModeType[]>['nothing', 'simple', 'key', 'fullname'];
    currentDateTime: Date;
    private unsubscribeTimer$ = new Subject<void>();

    startView: string;
    sideMode: string;
    resources: ResourceItem[] = [];
    navMode: any;
    navType: any;
    notifyMode: any;
    zoomMode: any;
    inputMode = InputModeType;
    headerMode = HeaderBarModeType;
    logo = null;
    loginOverlayColor = LoginOverlayColorType;
    ready = false;
    @ViewChild(CodemirrorComponent, {static: false}) CodeMirror: CodemirrorComponent;
    codeMirrorContent: string;
    codeMirrorOptions = {
        lineNumbers: true,
        theme: 'material',
        mode: 'css',
        lint: true,
    };
    expandedItems: Set<string> = new Set();
    private expandableNavItems = [Utils.getEnumKey(NaviItemType, NaviItemType.text), Utils.getEnumKey(NaviItemType, NaviItemType.inline)];
    constructor(@Inject(MAT_DIALOG_DATA) public data: ILayoutPropertyData,
        public dialog: MatDialog,
        public dialogRef: MatDialogRef<LayoutPropertyComponent>,
        private projectService: ProjectService,
        private changeDetector: ChangeDetectorRef,
        private translateService: TranslateService,
        private resourcesService: ResourcesService) {

        data.layout = <LayoutSettings>Utils.mergeDeep(new LayoutSettings(), data.layout);
        this.startView = data.layout.start;
        this.sideMode = data.layout.navigation.mode;
        if (!data.layout.navigation.items) {
            data.layout.navigation.items = [];
        }
        this.headerItems = data.layout.header.items ?? [];
        this.draggableListLeft = data.layout.navigation.items;
        this.resourcesService.getResources(ResourceType.images).subscribe((result: Resources) => {
            if (result) {
                result.groups.forEach((group: ResourceGroup) => {
                    this.resources.push(...group.items);
                });
            }
        });
    }

    ngOnInit() {
        this.navMode = NaviModeType;
        this.navType = NaviItemType;
        this.notifyMode = NotificationModeType;
        this.zoomMode = ZoomModeType;

        Object.keys(this.navMode).forEach(key => {
            this.translateService.get(this.navMode[key]).subscribe((txt: string) => {this.navMode[key] = txt;});
        });
        Object.keys(this.navType).forEach(key => {
            this.translateService.get(this.navType[key]).subscribe((txt: string) => {this.navType[key] = txt;});
        });
        Object.keys(this.notifyMode).forEach(key => {
            this.translateService.get(this.notifyMode[key]).subscribe((txt: string) => {this.notifyMode[key] = txt;});
        });
        Object.keys(this.zoomMode).forEach(key => {
            this.translateService.get(this.zoomMode[key]).subscribe((txt: string) => {this.zoomMode[key] = txt;});
        });
        Object.keys(this.inputMode).forEach(key => {
            this.translateService.get(this.inputMode[key]).subscribe((txt: string) => {this.inputMode[key] = txt;});
        });
        Object.keys(this.headerMode).forEach(key => {
            this.translateService.get(this.headerMode[key]).subscribe((txt: string) => {this.headerMode[key] = txt;});
        });
    }

    ngOnDestroy() {
        this.unsubscribeTimer$.next(null);
        this.unsubscribeTimer$.complete();
    }


    onTabChanged(event: MatTabChangeEvent): void {
        if (event.index == 3) {
            this.changeDetector.detectChanges();
            this.CodeMirror?.codeMirror?.refresh();
        } else if (event.index == 2) {
            this.checkTimer();
        }
    }

    checkTimer(): void {
        if (this.data.layout.header?.dateTimeDisplay) {
            if (!this.currentDateTime) {
                interval(1000).pipe(
                    takeUntil(this.unsubscribeTimer$)
                ).subscribe(() => {
                    this.currentDateTime = new Date();
                });
            }
        } else {
            this.unsubscribeTimer$.next(null);
            this.currentDateTime = null;
        }
    }

    onAddMenuItem(item: NaviItem = null) {
        let eitem = new NaviItem();
        if (item) {
            eitem = JSON.parse(JSON.stringify(item));
        }
        let views = JSON.parse(JSON.stringify(this.data.views));
        views.unshift({id: '', name: ''});
        let dialogRef = this.dialog.open(LayoutMenuItemPropertyComponent, {
            disableClose: true,
            position: { top: '60px' },
            data: { item: eitem, views: views, permission: eitem.permission, permissionRoles: eitem.permissionRoles }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                if (item) {
                    Object.assign(item, result.item);
                    item.icon = result.item.icon;
                    item.image = result.item.image;
                    item.text = result.item.text;
                    item.view = result.item.view;
                    item.link = result.item.link;
                    item.permission = result.permission;
                    item.permissionRoles = result.permissionRoles;
                } else {
                    let nitem = new NaviItem();
                    Object.assign(nitem, result.item);
                    nitem.icon = result.item.icon;
                    nitem.image = result.item.image;
                    nitem.text = result.item.text;
                    nitem.view = result.item.view;
                    nitem.link = result.item.link;
                    nitem.permission = result.permission;
                    nitem.permissionRoles = result.permissionRoles;
                    this.draggableListLeft.push(nitem);
                }
            }
        });
    }

    onRemoveMenuItem(index: number, item) {
        this.draggableListLeft.splice(index, 1);
    }

    onMoveMenuItem(index, direction) {
        if (direction === 'top' && index > 0) {
            this.draggableListLeft.splice(index - 1, 0, this.draggableListLeft.splice(index, 1)[0]);
        } else if (direction === 'bottom' && index < this.draggableListLeft.length) {
            this.draggableListLeft.splice(index + 1, 0, this.draggableListLeft.splice(index, 1)[0]);
        }
    }

    getViewName(vid: NaviItem) {
        if (vid.view) {
            const view = this.data.views.find(x=>x.id === vid.view);
            if (view) {
                return view.name;
            }
        } else if (vid.link) {
            return vid.link;
        } else {
            return '';
        }
    }

    onAddHeaderItem(item: HeaderItem = null) {
        let eitem = item ? JSON.parse(JSON.stringify(item)) : <HeaderItem> {
            id: Utils.getShortGUID('i_'),
            type: 'button',
            marginLeft: 5,
            marginRight: 5
        };
        let dialogRef = this.dialog.open(LayoutHeaderItemPropertyComponent, {
            position: { top: '60px' },
            data: eitem
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                if (item) {
                    const index = this.headerItems.findIndex(hi => hi.id === item.id);
                    this.headerItems[index] = result;
                } else {
                    this.headerItems.push(result);
                }
                this.data.layout.header.items = this.headerItems;
            }
        });
    }

    onRemoveHeaderItem(index: number, item: HeaderItem) {
        this.headerItems.splice(index, 1);
        this.data.layout.header.items = this.headerItems;
    }

    onMoveHeaderItem(index, direction) {
        if (direction === 'top' && index > 0) {
            this.headerItems.splice(index - 1, 0, this.headerItems.splice(index, 1)[0]);
        } else if (direction === 'bottom' && index < this.draggableListLeft.length) {
            this.headerItems.splice(index + 1, 0, this.headerItems.splice(index, 1)[0]);
        }
        this.data.layout.header.items = this.headerItems;
    }

    onEditPropertyItem(item: HeaderItem) {
        let settingsProperty = <ISettingsGaugeProperty>{ property: item.property ?? new GaugeProperty() };
        let hmi = this.projectService.getHmi();
        let dlgType = GaugeDialogType.RangeAndText;
        let title = this.translateService.instant('editor.header-item-settings');
        let dialogRef = this.dialog.open(GaugePropertyComponent, {
            position: { top: '60px' },
            data: {
                settings: settingsProperty,
                devices: Object.values(this.projectService.getDevices()),
                title: title,
                views: hmi.views,
                dlgType: dlgType,
                withEvents: true,
                withActions: HtmlButtonComponent.actionsType,
                withBitmask: false,
                withProperty: item.type !== 'label',
                scripts: this.projectService.getScripts(),
            }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                item.property = result.settings.property;
            }
        });
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    toggleSubMenu(item: NaviItem) {
        if (item.id && item.children?.length) {
            if (this.expandedItems.has(item.id)) {
                this.expandedItems.delete(item.id);
            } else {
                this.expandedItems.add(item.id);
            }
            this.changeDetector.detectChanges();
        }
    }

    isExpanded(item: NaviItem): boolean {
        if (!item.id) {
            item.id = Utils.getShortGUID();
        }
        return item.id ? this.expandedItems.has(item.id) : false;
    }

    isExpandable(item: NaviItem): boolean {
        return this.expandableNavItems.includes(this.data.layout.navigation.type) && item.children?.length > 0;
    }
}

export interface ILayoutPropertyData {
    layout: LayoutSettings;
    views: View[];
    securityEnabled: boolean;
}

interface ISettingsGaugeProperty {
    property: GaugeProperty;
}
