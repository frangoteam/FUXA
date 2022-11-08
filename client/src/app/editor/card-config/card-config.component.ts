import { Component, OnInit, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';

import { CardWidgetType, CardWidget } from '../../_models/hmi';
import { Utils } from '../../_helpers/utils';

@Component({
    selector: 'app-card-config',
    templateUrl: './card-config.component.html',
    styleUrls: ['./card-config.component.css']
})
export class CardConfigComponent implements OnInit {

    cardType = CardWidgetType;
    card: CardWidget;

    widgetView = Utils.getEnumKey(CardWidgetType, CardWidgetType.view);
    widgetIframe = Utils.getEnumKey(CardWidgetType, CardWidgetType.iframe);
    widgetAlarms = Utils.getEnumKey(CardWidgetType, CardWidgetType.alarms);
    widgetTable = Utils.getEnumKey(CardWidgetType, CardWidgetType.table);

    constructor(private translateService: TranslateService,
        public dialogRef: MatDialogRef<CardConfigComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any) {
        this.card = this.data.item.card;
        }

    ngOnInit() {
        Object.keys(this.cardType).forEach(key => {
            this.translateService.get(this.cardType[key]).subscribe((txt: string) => { this.cardType[key] = txt; });
        });
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.data.item.content = null;
        if (this.card.type === this.widgetView) {
            let view = this.data.views.find((v) => v.name === this.card.data);
            if (view) {
                this.data.item.content = view;
            }
        } else if (this.card.type === this.widgetIframe) {
            this.data.item.content = this.card.data;
        }
        this.dialogRef.close(this.data.item);
    }
}
