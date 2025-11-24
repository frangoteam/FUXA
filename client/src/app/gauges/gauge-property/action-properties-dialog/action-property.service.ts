import { Injectable } from '@angular/core';
import { GaugeActionsType, GaugeRangeProperty } from '../../../_models/hmi';
import { PipeActionsType } from '../../controls/pipe/pipe.component';
import { Utils } from '../../../_helpers/utils';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
    providedIn: 'root'
})
export class ActionPropertyService {

    constructor(
        private translateService: TranslateService,
    ) { }

    private getRange(range: GaugeRangeProperty): string {
        return `range(${range?.min} - ${range?.max})`;
    }

    typeToText(type: any): string {
        let text = '';
        if (type === Utils.getEnumKey(PipeActionsType, PipeActionsType.hidecontent)) {
            text = this.translateService.instant(PipeActionsType.hidecontent);
        } else if (type === Utils.getEnumKey(GaugeActionsType, GaugeActionsType.stop)) {
            text = this.translateService.instant(GaugeActionsType.stop);
        } else if (type === Utils.getEnumKey(GaugeActionsType, GaugeActionsType.clockwise)) {
            text = this.translateService.instant(GaugeActionsType.clockwise);
        } else if (type === Utils.getEnumKey(GaugeActionsType, GaugeActionsType.anticlockwise)) {
            text = this.translateService.instant(GaugeActionsType.anticlockwise);
        } else if (type === Utils.getEnumKey(GaugeActionsType, GaugeActionsType.blink)) {
            text = this.translateService.instant(GaugeActionsType.blink);
        } else if (type === Utils.getEnumKey(GaugeActionsType, GaugeActionsType.start)) {
            text = this.translateService.instant(GaugeActionsType.start);
        } else if (type === Utils.getEnumKey(GaugeActionsType, GaugeActionsType.pause)) {
            text = this.translateService.instant(GaugeActionsType.pause);
        } else if (type === Utils.getEnumKey(GaugeActionsType, GaugeActionsType.reset)) {
            text = this.translateService.instant(GaugeActionsType.reset);
        }
        return text;
    }
}
