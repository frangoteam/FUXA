import { Component, EventEmitter, OnInit, Input, Output } from '@angular/core';
import { Subject, ReplaySubject } from 'rxjs';

import { GaugeTableProperty, TableOptions } from '../../../../_models/hmi';

@Component({
    selector: 'app-table-property',
    templateUrl: './table-property.component.html',
    styleUrls: ['./table-property.component.css']
})
export class TablePropertyComponent implements OnInit {

    @Input() data: any;
    @Output() onPropChanged: EventEmitter<any> = new EventEmitter();
    @Input('reload') set reload(b: any) {
        this._reload();
    }

    options = <TableOptions> { paginator: { show: true }, header: { show: true, fontSize: 12 }, row: { fontSize: 10 } };

    private _onDestroy = new Subject<void>();

    constructor() { }

    ngOnInit() {
        if (!this.data.settings.property) {
            this.data.settings.property = <GaugeTableProperty>{ id: null, type: null, options: this.options };
        } 
    }

    ngOnDestroy() {
        this._onDestroy.next();
        this._onDestroy.complete();
    }

    private _reload() {
    }

    onTableChanged() {
        this.data.settings.property.options = JSON.parse(JSON.stringify(this.options));
        this.onPropChanged.emit(this.data.settings);
    }
}
