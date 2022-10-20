import { Component } from '@angular/core';

@Component({
    selector: 'app-tutorial',
    templateUrl: './tutorial.component.html',
    styleUrls: ['./tutorial.component.css']
})
export class TutorialComponent {

    show = false;

    constructor() { }

    close() {
        this.show = false;
    }
}
