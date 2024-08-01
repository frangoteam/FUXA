import { Component, EventEmitter, Input, Output } from '@angular/core';
import { View, ViewType } from '../../_models/hmi';
import { TranslateService } from '@ngx-translate/core';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../gui-helpers/confirm-dialog/confirm-dialog.component';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { ProjectService } from '../../_services/project.service';
import { ViewPropertyComponent, ViewPropertyType } from '../view-property/view-property.component';
import * as FileSaver from 'file-saver';
import { EditNameComponent, EditNameData } from '../../gui-helpers/edit-name/edit-name.component';

@Component({
    selector: 'app-editor-views-list',
    templateUrl: './editor-views-list.component.html',
    styleUrls: ['./editor-views-list.component.scss']
})
export class EditorViewsListComponent {

    @Input() views: View[] = [];
    @Input('select') set select(view: View) {
        this.currentView = view;
    };
    @Output() selected: EventEmitter<View> = new EventEmitter<View>();
    @Output() viewPropertyChanged: EventEmitter<View> = new EventEmitter<View>();
    @Output() cloneView: EventEmitter<View> = new EventEmitter<View>();

    currentView: View = null;

    cardViewType = ViewType.cards;
    svgViewType = ViewType.svg;

    constructor(private projectService: ProjectService,
        private translateService: TranslateService,
        public dialog: MatDialog,
    ) { }

    onSelectView(view: View, force = true) {
        if (!force && this.currentView?.id === view?.id) {
            return;
        }
        this.currentView = view;
        this.selected.emit(this.currentView);
    }

    getViewsSorted() {
        return this.views.sort((a, b) => {
            if (a.name > b.name) { return 1; }
            return -1;
        });
    }

    isViewActive(view) {
        return (this.currentView && this.currentView.name === view.name);
    }

    onDeleteView(view) {
        let msg = '';
        this.translateService.get('msg.view-remove', { value: view.name }).subscribe((txt: string) => { msg = txt; });
        let dialogRef = this.dialog.open(ConfirmDialogComponent, {
            position: { top: '60px' },
            data: <ConfirmDialogData> { msg: this.translateService.instant('msg.view-remove', { value: view.name }) }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result && this.views) {
                let toselect = null;
                for (var i = 0; i < this.views.length; i++) {
                    if (this.views[i].id === view.id) {
                        this.views.splice(i, 1);
                        if (i > 0 && i < this.views.length) {
                            toselect = this.views[i];
                        }
                        break;
                    }
                }
                this.currentView = null;
                if (toselect) {
                    this.onSelectView(toselect);
                } else if (this.views.length > 0) {
                    this.onSelectView(this.views[0]);
                }
                this.projectService.removeView(view);
            }
        });
    }

    onRenameView(view) {
        let exist = this.views.filter((v) => v.id !== view.id).map((v) => v.name);
        let dialogRef = this.dialog.open(EditNameComponent, {
            disableClose: true,
            position: { top: '60px' },
            data: <EditNameData> {
                title: this.translateService.instant('dlg.docname-title'),
                name: view.name,
                exist: exist
            }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result && result.name) {
                view.name = result.name;
                this.projectService.setView(view, false);
            }
        });
    }

    onPropertyView(view) {
        let dialogRef = this.dialog.open(ViewPropertyComponent, {
            position: { top: '60px' },
            disableClose: true,
            data: <ViewPropertyType> { name: view.name, type: view.type || ViewType.svg, profile: view.profile }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result?.profile) {
                if (result.profile.height) {view.profile.height = parseInt(result.profile.height);}
                if (result.profile.width) {view.profile.width = parseInt(result.profile.width);}
                if (result.profile.margin >= 0) {view.profile.margin = parseInt(result.profile.margin);}
                view.profile.bkcolor = result.profile.bkcolor;
                this.viewPropertyChanged.emit(view);
                this.onSelectView(view);
            }
        });
    }

    onCloneView(view: View) {
        this.cloneView.emit(view);
    }

    onExportView(view: View) {
        let filename = `${view.name}.json`;
        let content = JSON.stringify(view);
        let blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        FileSaver.saveAs(blob, filename);
    }
}
