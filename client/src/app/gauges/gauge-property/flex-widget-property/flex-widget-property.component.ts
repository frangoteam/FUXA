import { Component, Input, OnInit } from '@angular/core';
import { WidgetProperty } from '../../../_models/hmi';
import { ProjectService } from '../../../_services/project.service';
import { SvgUtils } from '../../../_helpers/svg-utils';

@Component({
    selector: 'flex-widget-property',
    templateUrl: './flex-widget-property.component.html',
    styleUrls: ['./flex-widget-property.component.scss']
})
export class FlexWidgetPropertyComponent implements OnInit {

    @Input() property: WidgetProperty;
    dataDevices = { devices: []};

    constructor(private projectService: ProjectService) {
        this.dataDevices = {
            devices: Object.values(this.projectService.getDevices())
        };
    }

    ngOnInit() {
        // Populate defaults from SVG script if available
        if (this.property?.varsToBind?.length && this.property?.scriptContent?.content) {
            this.property.varsToBind = SvgUtils.populateDefaults(
                this.property.scriptContent.content,
                this.property.varsToBind
            );
        }
    }
}
