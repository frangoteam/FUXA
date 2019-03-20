import { Component, ViewChild, OnInit } from '@angular/core';
import {Router} from '@angular/router';

import { ProjectService } from '../_services/project.service';

@Component({
    moduleId: module.id,
    selector: 'app-header',
    templateUrl: 'header.component.html',
    styleUrls: ['header.component.css']
})
export class HeaderComponent implements OnInit {

    ineditor: boolean = false;
    
    constructor(private router: Router,
                private projectService: ProjectService){
        this.router.events.subscribe(()=> {
            this.ineditor = (this.router.url.indexOf('editor') >= 0 ||  this.router.url.indexOf('device') >= 0) ? true : false;
        });
    }

    @ViewChild('sidenav')sidenav: any; 

    public onClick(targetElement) {
        this.sidenav.close();
    }

    ngOnInit() {
    }

    goTo(destination:string) {
        this.router.navigate([destination]);//, this.ID]);
    }

    //#region Project Events
    onNewProject() {
        try {
            if (window.confirm('You want to save the Project change?')) {
                this.onSaveProject();
                this.projectService.setNewProject();
            }
        } catch (e) {

        }
    }

    /**
     * save Project and Download in Browser 
     */
    onSaveProjectAs() {
        try {
            this.projectService.saveProject(true);
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
            // console.log(reader.result);
            let prj = JSON.parse(reader.result);
            this.projectService.setProject(prj, true);
        }

        reader.onerror = function () {
            alert('Unable to read ' + input.files[0]);
        };
        reader.readAsText(input.files[0]);
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