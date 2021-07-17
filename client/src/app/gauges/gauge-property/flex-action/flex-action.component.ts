import { Component, OnInit, Input } from '@angular/core';

import { TranslateService } from '@ngx-translate/core';

import { GaugeProperty, GaugeAction, GaugeRangeProperty, GaugeActionsType, GaugeActionBlink } from '../../../_models/hmi';

@Component({
    selector: 'flex-action',
    templateUrl: './flex-action.component.html',
    styleUrls: ['./flex-action.component.css']
})
export class FlexActionComponent implements OnInit {

    @Input() data: any;
    @Input() property: GaugeProperty;

    actions: GaugeAction[];
    actionsSupported: any;
    actionBlink = Object.keys(GaugeActionsType).find(key => GaugeActionsType[key] === GaugeActionsType.blink);
    itemtype: any;
    slideView = true;

    constructor(private translateService: TranslateService) { }

    ngOnInit() {
        if (this.property) {
            this.actions = this.property.actions;
        }
        if (!this.actions || this.actions.length <= 0) {
            this.onAddAction();
        }
        // this.itemtype = this.data.withActions.clockwise;
        if (this.data.withActions) {
			this.actionsSupported = this.data.withActions;
			Object.keys(this.actionsSupported).forEach(key => {
				this.translateService.get(this.actionsSupported[key]).subscribe((txt: string) => { this.actionsSupported[key] = txt });
			});
		}
    }

    getActions() {
        let result = null;
        if (this.actions) {
            result = [];
            this.actions.forEach(act => {
                if (act.variableId) {
                    result.push(act);
                }
            });
        }
        return result;
    }

    onAddAction() {
        let ga: GaugeAction = new GaugeAction();
        ga.range = new GaugeRangeProperty();
        this.addAction(ga);
    }

    onRemoveAction(index: number) {
        this.actions.splice(index, 1);
    }

    onRangeViewToggle(slideView) {
        this.slideView = slideView;
        // this.flexInput.changeTag(this.currentTag);
    }

    setVariable(index, event) {
        this.actions[index].variableId = event.variableId;
    }

    private addAction(ga: GaugeAction) {
        if (!this.actions) {
            this.actions = [];
        }
        this.actions.push(ga);
    }

    onCheckActionType(type: any, ga: GaugeAction) {
        if (type === this.actionBlink && typeof(ga.options) !== typeof(GaugeActionBlink)) {
            ga.options = new GaugeActionBlink();
        }
    }
}
