import { Component, OnInit, Input } from '@angular/core';

import { TranslateService } from '@ngx-translate/core';
import { Utils } from '../../../_helpers/utils';

import { GaugeProperty, GaugeAction, GaugeRangeProperty, GaugeActionsType, GaugeActionBlink, GaugeActionRotate, GaugeActionMove } from '../../../_models/hmi';

@Component({
    selector: 'flex-action',
    templateUrl: './flex-action.component.html',
    styleUrls: ['./flex-action.component.css']
})
export class FlexActionComponent implements OnInit {

    @Input() data: any;
    @Input() property: GaugeProperty;
    @Input() withBitmask = false;

    actions: GaugeAction[];
    actionsSupported: any;
    actionBlink = Object.keys(GaugeActionsType).find(key => GaugeActionsType[key] === GaugeActionsType.blink);
    actionRotate = Object.keys(GaugeActionsType).find(key => GaugeActionsType[key] === GaugeActionsType.rotate);
    actionMove = Object.keys(GaugeActionsType).find(key => GaugeActionsType[key] === GaugeActionsType.move);
    itemtype: any;
    slideView = true;
    defaultColor = Utils.defaultColor;

    constructor(private translateService: TranslateService) { }

    ngOnInit() {
        if (this.property) {
            this.actions = this.property.actions;
        }
        if (!this.actions || this.actions.length <= 0) {
            this.onAddAction();
        }
        if (this.data.withActions) {
			this.actionsSupported = this.data.withActions;
			Object.keys(this.actionsSupported).forEach(key => {
				this.translateService.get(this.actionsSupported[key]).subscribe((txt: string) => { this.actionsSupported[key] = txt; });
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
        this.actions[index].bitmask = event.bitmask;
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
        } else if (type === this.actionRotate && typeof(ga.options) !== typeof(GaugeActionRotate)) {
            ga.options = new GaugeActionRotate();
        } else if (type === this.actionMove && typeof(ga.options) !== typeof(GaugeActionMove)) {
            ga.options = new GaugeActionMove();
        }
    }
}
