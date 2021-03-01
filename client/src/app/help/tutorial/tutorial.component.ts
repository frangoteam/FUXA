import { Component, OnInit } from '@angular/core';

@Component({
    selector: 'app-tutorial',
    templateUrl: './tutorial.component.html',
    styleUrls: ['./tutorial.component.css']
})
export class TutorialComponent implements OnInit {

    show: boolean = false;

    constructor() { }

    ngOnInit() {
    }

    close() {
        this.show = false;
    }
}
