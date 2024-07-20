import { Component, OnInit, Inject } from '@angular/core';
import { MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { TranslateService } from '@ngx-translate/core';

import { CardWidgetType, CardWidget, PropertyScaleModeType } from '../../_models/hmi';
import { GridsterItem } from 'angular-gridster2';

@Component({
    selector: 'app-card-config',
    templateUrl: './card-config.component.html',
    styleUrls: ['./card-config.component.scss']
})
export class CardConfigComponent implements OnInit {

    cardType = CardWidgetType;
    card: CardWidget;
    scaleMode = PropertyScaleModeType;

    constructor(private translateService: TranslateService,
        public dialogRef: MatDialogRef<CardConfigComponent>,
        @Inject(MAT_DIALOG_DATA) public data: CardConfigType) {
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
        if (this.card.type === CardWidgetType.view) {
        } else if (this.card.type === CardWidgetType.iframe) {
            this.data.item.content = this.card.data;
        }
        this.dialogRef.close(this.data.item);
    }
}

export interface CardConfigType {
    item: GridsterItem;
    views: string[];
}
