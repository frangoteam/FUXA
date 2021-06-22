import { Component, OnInit, AfterViewInit, Input, Output, EventEmitter } from '@angular/core';

import { GaugesManager } from '../gauges/gauges.component';
import { Hmi, View, GaugeSettings, SelElement, LayoutSettings, ViewType, CardWidget, CardWidgetType } from '../_models/hmi';
import { GridsterConfig, GridsterItem, GridType, CompactType } from 'angular-gridster2';
import { Utils } from '../_helpers/utils';

@Component({
    selector: 'app-cards-view',
    templateUrl: './cards-view.component.html',
    styleUrls: ['./cards-view.component.css']
})
export class CardsViewComponent implements OnInit, AfterViewInit {

    @Input() view: View;
    @Input() hmi: Hmi;
    @Input() gaugesManager: GaugesManager;        // gauges.component
    @Output() editCard: EventEmitter<CardWidget> = new EventEmitter()

    gridOptions: GridsterConfig;
    dashboard: Array<GridsterItem> = [];

    widgetView = Utils.getEnumKey(CardWidgetType, CardWidgetType.view);
    widgetAlarms = Utils.getEnumKey(CardWidgetType, CardWidgetType.alarms);
    widgetTable = Utils.getEnumKey(CardWidgetType, CardWidgetType.table);

    constructor() { }

    ngOnInit() {
        this.gridOptions = {
            gridType: GridType.Fixed,
            compactType: CompactType.None,
            maxCols: 20,
            maxRows: 20,
            fixedColWidth: 95,
            fixedRowHeight: 95,
            disableWarnings: true,
            draggable: {
                enabled: true,
            },
            resizable: {
                enabled: true,
            },
            itemChangeCallback: this.itemChange,
            itemResizeCallback: this.itemChange,
        };
    }

    ngAfterViewInit() {
        setTimeout(() => {
            this.initCardsEditor(this.view.svgcontent);
        }, 500);
    }

    initCardsEditor(dashboardContent: string) {
        this.dashboard = [];
        if (dashboardContent) {
            let dashboard = JSON.parse(dashboardContent);
            for (let i = 0; i < dashboard.length; i++) {
                this.addCardsWidget(dashboard[i].x, dashboard[i].y, dashboard[i].cols, dashboard[i].rows, dashboard[i].card);
            }
        } else {
            this.addCardsWidget(0, 0, 4, 3, <CardWidget>{ type: Utils.getEnumKey(CardWidgetType, CardWidgetType.view) });
        }
    }

    onEditCard(item) {
        this.editCard.emit(item);
    }

    onRemoveCard(item) {
        this.dashboard.splice(this.dashboard.indexOf(item), 1);
        this.view.svgcontent = JSON.stringify(this.dashboard);
    }

    addCardsWidget(x: number = 0, y: number = 0, cols: number = 4, rows: number = 3, card: CardWidget = <CardWidget>{ type: Utils.getEnumKey(CardWidgetType, CardWidgetType.view) }) {
        let content: any = null;
        let background = '';
        if (card) {
            let views = this.hmi.views.filter((v) => v.name === card.data);
            if (views && views.length) {
                if (views[0].svgcontent) {
                    content = views[0];//.svgcontent.replace('<title>Layer 1</title>', '');
                }
                if (views[0].profile.bkcolor) {
                    background = views[0].profile.bkcolor;
                }
            }
        }
        this.dashboard.push({ x: x, y: y, cols: cols, rows: rows, card: card, content: content, background: background });
        this.view.svgcontent = JSON.stringify(this.dashboard);
    }

    render() {
        this.initCardsEditor(this.view.svgcontent);
    }

    getContent() {
        return JSON.stringify(this.dashboard);
    }

    getWindgetViewName() {
        let widgetType = Utils.getEnumKey(CardWidgetType, CardWidgetType.view);
        let viewsName = this.dashboard.filter((c) => c.card.type === widgetType && c.card.data).map((c) => { return c.card.data })
        return viewsName;
    }

    private itemChange(item, itemComponent) {
        // console.info('itemResized', item, itemComponent);
        if (item.background && itemComponent.el) {
            itemComponent.el.style.backgroundColor = item.background;
        }
    }
}
