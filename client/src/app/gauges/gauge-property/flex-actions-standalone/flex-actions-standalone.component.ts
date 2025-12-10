import { Component, Input, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { Utils } from '../../../_helpers/utils';
import { GaugeAction, GaugeActionBlink, GaugeActionsType, GaugeRangeProperty } from '../../../_models/hmi';
import { ProjectService } from '../../../_services/project.service';

@Component({
    selector: 'flex-actions-standalone',
    templateUrl: './flex-actions-standalone.component.html',
    styleUrls: ['./flex-actions-standalone.component.scss']
})
export class FlexActionsStandaloneComponent implements OnInit {

    @Input() actions: GaugeAction[];
    actionsSupported: any = {
        show: GaugeActionsType.show,
        hide: GaugeActionsType.hide,
        // blink: GaugeActionsType.blink,
        color: GaugeActionsType.color
    };
    actionBlink = Object.keys(GaugeActionsType).find(key => GaugeActionsType[key] === GaugeActionsType.blink);
    actionColor = Object.keys(GaugeActionsType).find(key => GaugeActionsType[key] === GaugeActionsType.color);
    slideView = true;
    defaultColor = Utils.defaultColor;
    data: any;

    constructor(private translateService: TranslateService,
                private projectService: ProjectService) { }

    ngOnInit() {
        this.data = { devices: this.projectService.getDevices() };
        if (!this.actions || this.actions.length <= 0) {
            this.onAddAction();
        }
        Object.keys(this.actionsSupported).forEach(key => {
            this.actionsSupported[key] = this.translateService.instant(this.actionsSupported[key]);
        });
    }

    getActions() {
        if (!this.actions) {
            return null;
        }
        return this.actions.filter(act => !!act.variableId && this.isRangeValid(act.range));
    }

    onAddAction() {
        const ga = new GaugeAction();
        ga.range = new GaugeRangeProperty();
        this.addAction(ga);
    }

    onRemoveAction(index: number) {
        this.actions.splice(index, 1);
    }

    onRangeViewToggle(slideView: boolean) {
        this.slideView = slideView;
    }

    setVariable(index: number, event: any) {
        this.actions[index].variableId = event.variableId;
    }

    onCheckActionType(type: any, ga: GaugeAction) {
        if (type === this.actionBlink) {
            if (!(ga.options instanceof GaugeActionBlink)) {
                ga.options = new GaugeActionBlink();
            }
        } else if (type === this.actionColor) {
            ga.options = {
                fillA: ga.options?.fillA ?? null,
                strokeA: ga.options?.strokeA ?? null,
            };
        } else {
            ga.options = {};
        }
    }

    private addAction(ga: GaugeAction) {
        if (!this.actions) {
            this.actions = [];
        }
        this.actions.push(ga);
    }

    private isRangeValid(range: GaugeRangeProperty | undefined) {
        if (!range) {
            return false;
        }
        const min = Number(range.min);
        const max = Number(range.max);
        return Number.isFinite(min) && Number.isFinite(max);
    }
}
