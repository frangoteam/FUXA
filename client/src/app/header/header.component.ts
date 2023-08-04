/* eslint-disable @angular-eslint/component-class-suffix */
/* eslint-disable @angular-eslint/component-selector */
import { Component, Inject, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { environment } from '../../environments/environment';

import { SetupComponent } from '../editor/setup/setup.component';

import { ProjectService, SaveMode } from '../_services/project.service';
import { ThemeService } from '../_services/theme.service';

import { HelpData, DEVICE_READONLY } from '../_models/hmi';
import { TutorialComponent } from '../help/tutorial/tutorial.component';
import { TranslateService } from '@ngx-translate/core';
import { EditNameComponent } from '../gui-helpers/edit-name/edit-name.component';

@Component({
    moduleId: module.id,
    selector: 'app-header',
    templateUrl: 'header.component.html',
    styleUrls: ['header.component.css']
})
export class HeaderComponent implements AfterViewInit, OnDestroy {

    @ViewChild('sidenav', {static: false})sidenav: any;
    @ViewChild('tutorial', {static: false}) tutorial: TutorialComponent;
    @ViewChild('fileImportInput', {static: false}) fileImportInput: any;

    darkTheme = true;
    editorMode = false;
    savededitor = false;
    private subscriptionShowHelp: Subscription;
    private subscriptionLoad: Subscription;

    constructor(private router: Router,
                public dialog: MatDialog,
                private translateService: TranslateService,
                private themeService: ThemeService,
                private projectService: ProjectService){

        this.router.events.subscribe(()=> {
            this.editorMode = (this.router.url.indexOf('editor') >= 0 ||  this.router.url.indexOf('device') >= 0 ||
                                this.router.url.indexOf('users') >= 0 || this.router.url.indexOf('text') >= 0 ||
                                this.router.url.indexOf('messages') >= 0 || this.router.url.indexOf('events') >= 0 ||
                                this.router.url.indexOf('notifications') >= 0 || this.router.url.indexOf('scripts') >= 0 ||
                                this.router.url.indexOf('reports') >= 0) ? true : false;
            this.savededitor = (this.router.url.indexOf('device') >= 0 || this.router.url.indexOf('users') >= 0 ||
                                this.router.url.indexOf('text') >= 0 || this.router.url.indexOf('messages') >= 0 ||
                                this.router.url.indexOf('events') >= 0 || this.router.url.indexOf('notifications') >= 0 ||
                                this.router.url.indexOf('scripts') >= 0 || this.router.url.indexOf('reports') >= 0) ? true : false;

            if (this.router.url.indexOf(DEVICE_READONLY) >= 0) {
                this.editorMode = false;
            }
        });
        this.themeService.setTheme(this.projectService.getLayoutTheme());
    }

    ngAfterViewInit() {
        this.subscriptionLoad = this.projectService.onLoadHmi.subscribe(load => {
            let theme = this.projectService.getLayoutTheme();
            this.darkTheme = (theme !== ThemeService.ThemeType.Default);
            this.themeService.setTheme(this.projectService.getLayoutTheme());
        }, error => {
            console.error('Error loadHMI');
        });
    }

    ngOnDestroy() {
        try {
            if (this.subscriptionShowHelp) {
                this.subscriptionShowHelp.unsubscribe();
            }
            if (this.subscriptionLoad) {
                this.subscriptionLoad.unsubscribe();
            }
        } catch (e) {
        }
      }

    public onClick(targetElement) {
        this.sidenav.close();
    }

    onShowHelp(page) {
        let data = new HelpData();
        data.page = page;
        data.tag = 'device';
        this.showHelp(data);
    }

    onSetup() {
        this.projectService.saveProject(SaveMode.Current);
        let dialogRef = this.dialog.open(SetupComponent, {
            position: { top: '60px' },
        });
    }

    showHelp(data: HelpData) {
        if (data.page === 'help') {
            this.tutorial.show = true;
        } else if (data.page === 'info') {
            this.showInfo();
        }
    }

    showInfo() {
        let dialogRef = this.dialog.open(DialogInfo, {
            data: { name: 'Info', version: environment.version }
        });

        dialogRef.afterClosed().subscribe(result => {
        });
    }

    goTo(destination: string) {
        this.router.navigate([destination]);//, this.ID]);
    }

    onChangeTheme() {
        this.darkTheme = !this.darkTheme;
        let theme = ThemeService.ThemeType.Default;
        if (this.darkTheme) {
            theme = ThemeService.ThemeType.Dark;
        }
        this.themeService.setTheme(theme);
        this.projectService.setLayoutTheme(theme);
    }

    //#region Project Events
    onNewProject() {
        try {
            let msg = '';
            this.translateService.get('msg.project-save-ask').subscribe((txt: string) => { msg = txt; });
            if (window.confirm(msg)) {
                this.projectService.setNewProject();
                this.onRenameProject();
            }
        } catch (err) {
            console.error(err);
        }
    }

    /**
     * Aave Project as JSON file and Download in Browser
     */
    onSaveProjectAs() {
        try {
            if (this.savededitor) {
                this.projectService.saveAs();
            } else {
                this.projectService.saveProject(SaveMode.SaveAs);
            }
        } catch (e) {

        }
    }

    onOpenProject() {
        let ele = document.getElementById('projectFileUpload') as HTMLElement;
        ele.click();
    }

    /**
     * open Project event file loaded
     * @param event file resource
     */
    onFileChangeListener(event) {
        let input = event.target;
        let reader = new FileReader();
        reader.onload = (data) => {
            let prj = JSON.parse(reader.result.toString());
            this.projectService.setProject(prj, true);
        };

        reader.onerror = function() {
            let msg = 'Unable to read ' + input.files[0];
            // this.translateService.get('msg.project-load-error', {value: input.files[0]}).subscribe((txt: string) => { msg = txt });
            alert(msg);
        };
        reader.readAsText(input.files[0]);
        this.fileImportInput.nativeElement.value = null;
    }

    /**
     * save Project and Download in Browser
     */
    onSaveProject() {
        try {
            if (this.savededitor) {
                this.projectService.save();
            } else {
                this.projectService.saveProject(SaveMode.Save);
            }
        } catch (e) {
            console.error(e);
        }
    }

    /**
     * rename the project
     */
    onRenameProject() {
        let title = '';
        this.translateService.get('project.name').subscribe((txt: string) => { title = txt; });
        let dialogRef = this.dialog.open(EditNameComponent, {
            position: { top: '60px' },
            data: { name: this.projectService.getProjectName(), title: title }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result && result.name !== this.projectService.getProjectName()) {
                this.projectService.setProjectName(result.name.replace(/ /g,''));
            }
        });
    }
    //#endregion
}


@Component({
    selector: 'dialog-info',
    templateUrl: 'info.dialog.html',
})
export class DialogInfo {
    constructor(
        public dialogRef: MatDialogRef<DialogInfo>,
        @Inject(MAT_DIALOG_DATA) public data: any) { }

    onNoClick(): void {
        this.dialogRef.close();
    }
}
