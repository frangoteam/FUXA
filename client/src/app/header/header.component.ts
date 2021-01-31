import { Component, Inject, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from "rxjs";
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

import { environment } from '../../environments/environment';

import { SetupComponent } from '../editor/setup/setup.component';

import { ProjectService } from '../_services/project.service';
import { HelpData } from '../_models/hmi';
import { TutorialComponent } from '../help/tutorial/tutorial.component';
import { TranslateService } from '@ngx-translate/core';

@Component({
    moduleId: module.id,
    selector: 'app-header',
    templateUrl: 'header.component.html',
    styleUrls: ['header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {

    @ViewChild('sidenav')sidenav: any; 
    @ViewChild('tutorial') tutorial: TutorialComponent;
    @ViewChild('fileImportInput') fileImportInput: any;

    ineditor = false;
    savededitor = false;
    winele = false;
    private subscriptionShowHelp: Subscription;
    
    constructor(private router: Router,
                public dialog: MatDialog,
                private translateService: TranslateService,
                private projectService: ProjectService){

        this.router.events.subscribe(()=> {
            this.ineditor = (this.router.url.indexOf('editor') >= 0 ||  this.router.url.indexOf('device') >= 0 ||
            this.router.url.indexOf('users') >= 0 || this.router.url.indexOf('text') >= 0 || this.router.url.indexOf('messages') >= 0) ? true : false;
            this.savededitor = (this.router.url.indexOf('device') >= 0 || this.router.url.indexOf('users') >= 0 || 
                                this.router.url.indexOf('text') >= 0 || this.router.url.indexOf('messages') >= 0) ? true : false;
        });
    }

    ngOnInit() {
        if (environment.type === 'winele') {
            this.winele = true;
        }
    }

    ngOnDestroy() {
        try {
          if (this.subscriptionShowHelp) {
            this.subscriptionShowHelp.unsubscribe();
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

    goTo(destination:string) {
        this.router.navigate([destination]);//, this.ID]);
    }

    //#region Project Events
    onNewProject() {
        try {
            let msg = '';
            this.translateService.get('msg.project-save-ask').subscribe((txt: string) => { msg = txt });
            if (window.confirm(msg)) {
                this.projectService.saveProject();
                this.projectService.setNewProject();
            }
        } catch (e) {

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
                this.projectService.saveProject(true);
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
        let text = [];
        let files = event.srcElement.files;
        let input = event.target;
        let reader = new FileReader();
        reader.onload = (data) => {
            let prj = JSON.parse(reader.result.toString());
            this.projectService.setProject(prj, true);
        }

        reader.onerror = function () {
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
            this.projectService.saveProject();
        } catch (e) {

        }
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