/* eslint-disable @angular-eslint/component-class-suffix */
import { Component, OnInit, Inject, ViewChild } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';

import { SelOptionsComponent } from '../../gui-helpers/sel-options/sel-options.component';
import { ProjectService } from '../../_services/project.service';

import { LayoutSettings, NaviModeType, NaviItem, NaviItemType, NotificationModeType, ZoomModeType, InputModeType, HeaderBarModeType, LinkType } from '../../_models/hmi';
import { Define } from '../../_helpers/define';
import { UserGroups } from '../../_models/user';
import { Utils } from '../../_helpers/utils';
import { UploadFile } from '../../_models/project';
import { ResourceGroup, ResourceItem, Resources, ResourceType } from '../../_models/resources';
import { ResourcesService } from '../../_services/resources.service';
import { map, Observable, of } from 'rxjs';

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
    resources: ResourceItem[] = [];
    navMode: any;
    navType: any;
    notifyMode: any;
    zoomMode: any;
    inputMode = InputModeType;
    headerMode = HeaderBarModeType;
    logo = null;

    constructor(@Inject(MAT_DIALOG_DATA) public data: any,
        public dialog: MatDialog,
        public dialogRef: MatDialogRef<LayoutPropertyComponent>,
        private translateService: TranslateService,
        private resourcesService: ResourcesService) {

        data.layout = Utils.mergeDeep(new LayoutSettings(), data.layout);
        this.startView = data.layout.start;
        this.sideMode = data.layout.navigation.mode;
        if (!data.layout.navigation.items) {
            data.layout.navigation.items = [];
        }
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
                    item.image = result.item.image;
                    item.text = result.item.text;
                    item.view = result.item.view;
                    item.link = result.item.link;
                    item.permission = result.permission;
                } else {
                    let nitem = new NaviItem();
                    nitem.icon = result.item.icon;
                    nitem.image = result.item.image;
                    nitem.text = result.item.text;
                    nitem.view = result.item.view;
                    nitem.link = result.item.link;
                    nitem.permission = result.permission;
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
            nitem.image = item.image;
            nitem.text = item.text;
            nitem.view = item.view;
            nitem.link = item.link;
            this.data.layout.navigation.items.push(nitem);
        });
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
    icons$: Observable<string[]>;
    linkAddress = LinkType.address;
    linkAlarms = LinkType.alarms;

    @ViewChild(SelOptionsComponent, {static: false}) seloptions: SelOptionsComponent;

    constructor(public projectService: ProjectService,
                public dialogRef: MatDialogRef<DialogMenuItem>,
                @Inject(MAT_DIALOG_DATA) public data: any) {
        this.selectedGroups = UserGroups.ValueToGroups(this.data.permission);

        this.icons$ = of(Define.MaterialIconsRegular).pipe(
          map((data: string) => data.split('\n')),
          map(lines => lines.map(line => line.split(' ')[0])),
          map(names => names.filter(name => !!name))
        );
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
		this.data.permission = UserGroups.GroupsToValue(this.seloptions.selected);
        this.dialogRef.close(this.data);
    }

    /**
     * add image to view
     * @param event selected file
     */
    onSetImage(event) {
        if (event.target.files) {
            let filename = event.target.files[0].name;
            let fileToUpload = { type: filename.split('.').pop().toLowerCase(), name: filename.split('/').pop(), data: null };
            let reader = new FileReader();
            reader.onload = () => {
                try {
                    fileToUpload.data = reader.result;
                    this.projectService.uploadFile(fileToUpload).subscribe((result: UploadFile) => {
                        this.data.item.image = result.location;
                        this.data.item.icon = null;
                    });
                } catch (err) {
                    console.error(err);
                }
            };
            if (fileToUpload.type === 'svg') {
                reader.readAsText(event.target.files[0]);
            } else {
                reader.readAsDataURL(event.target.files[0]);
            }
        }
    }
}
