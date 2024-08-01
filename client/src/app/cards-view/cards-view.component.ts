import { Component, OnInit, AfterViewInit, Input, Output, EventEmitter, Renderer2 } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';

import { GaugesManager } from '../gauges/gauges.component';
import { Hmi, View, CardWidget, CardWidgetType } from '../_models/hmi';
import { GridsterConfig, GridsterItem, GridType, CompactType, GridsterItemComponentInterface } from 'angular-gridster2';
import { Utils } from '../_helpers/utils';

@Component({
    selector: 'app-cards-view',
    templateUrl: './cards-view.component.html',
    styleUrls: ['./cards-view.component.scss']
})
export class CardsViewComponent implements OnInit, AfterViewInit {

    @Input() options: GridsterConfig;
    @Input() edit = true;
    @Input() view: View;
    @Input() hmi: Hmi;
    @Input() gaugesManager: GaugesManager;        // gauges.component
    @Output() editCard: EventEmitter<CardWidget> = new EventEmitter();

    gridOptions: GridsterConfig;
    dashboard: Array<GridsterItem> = [];
    cardType = CardWidgetType;

    constructor(private renderer: Renderer2,
                private changeDetector: ChangeDetectorRef) {
        this.gridOptions = <GridsterConfig> new GridOptions();
        this.gridOptions.itemChangeCallback = this.itemChange;
        this.gridOptions.itemResizeCallback = CardsViewComponent.itemResizeTrigger;
    }

    ngOnInit() {
        this.gridOptions = { ...this.gridOptions, ...this.options };
    }

    ngAfterViewInit() {
        setTimeout(() => {
            this.reload();
        }, 200);
    }

    reload() {
        let element: HTMLElement = document.querySelector('gridster');
        if (element) {
            if (this.view.profile.bkcolor) {
                element.style.backgroundColor = this.view.profile.bkcolor;
            }
            if (!this.edit) {
                this.renderer.setStyle(element?.parentElement, 'width', `100vw`);
            }
        }
        this.gridOptions.gridType = this.view.profile.gridType ?? GridType.Fixed;
        if (this.view.profile.margin >= 0) {
            this.gridOptions.margin = this.view.profile.margin;
            this.gridOptions.api.optionsChanged();
        }
        this.initCardsEditor(this.view.svgcontent);
    }

    initCardsEditor(dashboardContent: string) {
        this.dashboard = [];
        if (dashboardContent) {
            let dashboard = JSON.parse(dashboardContent);
            for (let i = 0; i < dashboard.length; i++) {
                this.addCardsWidget(dashboard[i].x, dashboard[i].y, dashboard[i].cols, dashboard[i].rows, dashboard[i].card);
            }
        } else {
            this.addCardsWidget(0, 0, 10, 8, <CardWidget>{ type: CardWidgetType.view });
        }
    }

    onEditCard(item) {
        this.editCard.emit(item);
    }

    onRemoveCard(item) {
        this.dashboard.splice(this.dashboard.indexOf(item), 1);
        this.view.svgcontent = JSON.stringify(this.dashboard);
    }

    addCardsWidget(x: number = 0, y: number = 0, cols: number = 10, rows: number = 8, card: CardWidget = <CardWidget>{ type: CardWidgetType.view, zoom: 1 }) {
        let content: any = null;
        let background = '';
        let item: GridsterItem = { x: x, y: y, cols: cols, rows: rows, card: card, content: content, background: background };
        item.initCallback = () => {
            if (card) {
                if (card.type === this.cardType.view) {
                    let views = this.hmi.views.filter((v) => v.name === card.data);
                    if (views && views.length) {
                        if (views[0].svgcontent) {
                            item.content = views[0];//.svgcontent.replace('<title>Layer 1</title>', '');
                        }
                        if (views[0].profile.bkcolor) {
                            item.background = views[0].profile.bkcolor;
                        }
                    }
                } else if (card.type === this.cardType.alarms) {
                    item.background = '#CCCCCC';
                    item.content = ' ';
                } else if (card.type === this.cardType.iframe) {
                    item.content = card.data;
                }
                this.changeDetector.detectChanges();
            }
        };
        this.dashboard.push(item);
    }

    render() {
        this.initCardsEditor(this.view.svgcontent);
    }

    getContent() {
        return JSON.stringify(this.dashboard);
    }

    getWindgetViewName() {
        let viewsName = this.dashboard.filter((c) => c.card.type === CardWidgetType.view && c.card.data).map((c) => c.card.data);
        return viewsName;
    }

    onZoomChanged(item: GridsterItem, $event) {
        item.card.zoom = $event.value;
    }

    private itemChange(item, itemComponent) {
        // console.info('itemResized', item, itemComponent);
        if (itemComponent.el) {
            if (item.background) {
                itemComponent.el.style.backgroundColor = item.background;
            }
            if (item.card.type === CardWidgetType.alarms || item.card.type === CardWidgetType.iframe) {
                itemComponent.el.classList.add('card-html');
            }
        }
    }

    static itemResizeTrigger(item: GridsterItem, itemComponent: GridsterItemComponentInterface) {
        if (item.card?.type === CardWidgetType.view) {
            let ratioWidth, ratioHeight, eleToResize;
            ratioWidth = itemComponent.el.clientWidth / item.content?.profile?.width;
            ratioHeight = itemComponent.el.clientHeight / item.content?.profile?.height;
            eleToResize = Utils.searchTreeTagName(itemComponent.el, 'svg');
            if (item.card?.scaleMode === 'contain') {
                eleToResize?.setAttribute('transform', 'scale(' + Math.min(ratioWidth, ratioHeight) + ')');
            } else if (item.card?.scaleMode === 'stretch') {
                eleToResize?.setAttribute('transform', 'scale(' + ratioWidth + ', ' + ratioHeight + ')');
            }
        } else if (item.card.type === CardWidgetType.iframe) {
            if ((itemComponent.el.firstChild as HTMLElement).style) {
                (itemComponent.el.firstChild as HTMLElement).style.height = '100%';
                (itemComponent.el.firstChild as HTMLElement).style.width = '100%';
            }
        }

    }
}

export class NgxNouisliderOptions {
    orientation = 'vertical';//'horizontal';
    direction = 'ltr';
    fontFamily = 'Sans-serif';
    shape = { baseColor: '#dcdcdc', connectColor: '#49b2ff', handleColor: '#018ef5' };
    marker = { color: '#000', subWidth: 5, subHeight: 1, fontSize: 18, divHeight: 2, divWidth: 12 };
    range = { min: 0, max: 100 };
    step = 1;
    pips = { mode: 'values', values: [0, 50, 100], density: 4 };
    tooltip = { type: 'none', decimals: 0, background: '#FFF', color: '#000', fontSize: 12 };
}

export class GridOptions {
    gridType = GridType.Fixed;
    compactType = CompactType.None;
    maxCols = 100;
    maxRows = 100;
    fixedColWidth = 35;
    fixedRowHeight = 35;
    margin = 10;
    disableWarnings = true;
    draggable = { enabled: true };
    resizable = { enabled: true };
};
