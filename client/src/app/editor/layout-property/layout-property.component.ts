import { Component, OnInit, Inject, ViewChild } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { TranslateService } from '@ngx-translate/core';

import { SelOptionsComponent } from '../../gui-helpers/sel-options/sel-options.component';

import { LayoutSettings, NaviModeType, NaviItem, NaviItemType, NotificationModeType, ZoomModeType } from '../../_models/hmi';
import { Define } from '../../_helpers/define';
import { UserGroups } from '../../_models/user';
import { Utils } from '../../_helpers/utils';

@Component({
    selector: 'app-layout-property',
    templateUrl: './layout-property.component.html',
    styleUrls: ['./layout-property.component.scss']
})
export class LayoutPropertyComponent implements OnInit {

    draggableListLeft = [];
    layout: any;
    defaultColor = Utils.defaultColor;

    startView: string;
    sideMode: string;
    navMode: any;
    navType: any;
    notifyMode: any;
    zoomMode: any;

    constructor(@Inject(MAT_DIALOG_DATA) public data: any,
        public dialog: MatDialog,
        public dialogRef: MatDialogRef<LayoutPropertyComponent>,
        private translateService: TranslateService) {
        if (!data.layout) {
            data.layout = new LayoutSettings();
        }
        this.startView = data.layout.start;
        this.sideMode = data.layout.navigation.mode;
        if (!data.layout.navigation.items) {
            data.layout.navigation.items = [];
        }
        this.draggableListLeft = data.layout.navigation.items;
    }

    ngOnInit() {
        this.navMode = NaviModeType;
        this.navType = NaviItemType;
        this.notifyMode = NotificationModeType;
        this.zoomMode = ZoomModeType;

        Object.keys(this.navMode).forEach(key => {
            this.translateService.get(this.navMode[key]).subscribe((txt: string) => {this.navMode[key] = txt});
        });
        Object.keys(this.navType).forEach(key => {
            this.translateService.get(this.navType[key]).subscribe((txt: string) => {this.navType[key] = txt});
        });
        Object.keys(this.notifyMode).forEach(key => {
            this.translateService.get(this.notifyMode[key]).subscribe((txt: string) => {this.notifyMode[key] = txt});
        });
        Object.keys(this.zoomMode).forEach(key => {
            this.translateService.get(this.zoomMode[key]).subscribe((txt: string) => {this.zoomMode[key] = txt});
        });
    }

    onAddMenuItem(item) {
        let eitem = new NaviItem();
        if (item) {
            eitem = JSON.parse(JSON.stringify(item));
        }
        let views = JSON.parse(JSON.stringify(this.data.views));
        views.unshift({id: '', name: ''});
        let dialogRef = this.dialog.open(DialogMenuItem, {
            position: { top: '60px' },
            data: { item: eitem, views: views, permission: eitem.permission }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                if (item) {
                    item.icon = result.item.icon;
                    item.text = result.item.text;
                    item.view = result.item.view;
                    item.link = result.item.link;
                    item.permission = result.permission; 
                    if (item.view) {
                        item.link = '';
                    }
                } else {
                    let nitem = new NaviItem();
                    nitem.icon = result.item.icon;
                    nitem.text = result.item.text;
                    nitem.view = result.item.view;
                    nitem.link = result.item.link;
                    nitem.permission = result.permission; 
                    if (nitem.view) {
                        nitem.link = '';
                    }
                    this.draggableListLeft.push(nitem);
                }
            }
        });
        // this.winRef.nativeWindow.svgEditor.showDocProperties();
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

    onOkClick() {
        this.data.layout.navigation.items = [];
        this.draggableListLeft.forEach(item => {
            let nitem = new NaviItem();
            nitem.icon = item.icon;
            nitem.text = item.text;
            nitem.view = item.view;
            nitem.link = item.link;
            this.data.layout.navigation.items.push(nitem);            
        })
    }

    onNoClick(): void {
		this.dialogRef.close();
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
}

@Component({
    selector: 'dialog-menuitem',
    templateUrl: './menuitem.dialog.html',
})
export class DialogMenuItem {
    // defaultColor = Utils.defaultColor;
	selectedGroups = [];
    groups = UserGroups.Groups;    
    icons = Define.materialIcons;

    @ViewChild(SelOptionsComponent) seloptions: SelOptionsComponent;

    constructor(
        public dialogRef: MatDialogRef<DialogMenuItem>,
        @Inject(MAT_DIALOG_DATA) public data: any) { 
            this.selectedGroups = UserGroups.ValueToGroups(this.data.permission);
        }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
		this.data.permission = UserGroups.GroupsToValue(this.seloptions.selected);
        this.dialogRef.close(this.data);
    }
}