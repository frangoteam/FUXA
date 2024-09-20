import { Component, Input } from '@angular/core';
import { WidgetProperty } from '../../../_models/hmi';
import { ProjectService } from '../../../_services/project.service';

@Component({
    selector: 'flex-widget-property',
    templateUrl: './flex-widget-property.component.html',
    styleUrls: ['./flex-widget-property.component.scss']
})
export class FlexWidgetPropertyComponent {

    @Input() property: WidgetProperty;
    dataDevices = { devices: []};

    constructor(private projectService: ProjectService) {
        this.dataDevices = {
            devices: Object.values(this.projectService.getDevices())
        };
    }
}
