import { Component, EventEmitter, OnInit, Input, Output } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ReplaySubject, Subject } from 'rxjs';
import { UntypedFormControl } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';

import { RepeaterProperty } from '../../../../_models/hmi';
import { RepeaterData } from '../../../../_models/repeater';
import { RepeaterConfigComponent, IDataRepeaterDataResult } from '../../../../editor/repeater-config/repeater-config.component';

@Component({
    selector: 'app-repeater-property',
    templateUrl: './repeater-property.component.html',
    styleUrls: ['./repeater-property.component.css']
})
export class RepeaterPropertyComponent implements OnInit {

    @Input() data: any;
    @Output() onPropChanged: EventEmitter<any> = new EventEmitter();
    @Input('reload') set reload(b: any) {
        this._reload();
    }

    public repeaterDataCtrl: UntypedFormControl = new UntypedFormControl();
    public repeaterDataFilterCtrl: UntypedFormControl = new UntypedFormControl();
    public filteredRepeaterData: ReplaySubject<RepeaterData[]> = new ReplaySubject<RepeaterData[]>(1);
    property: RepeaterProperty;

    private _onDestroy = new Subject<void>();

    constructor(public dialog: MatDialog) {
    }

    ngOnInit() {
        this._reload();
    }

    onPropertyChanged() {
        this.onPropChanged.emit(this.data.settings);
    }

    private _reload() {
        if (!this.data.settings.property) {
            this.data.settings.property = { repeaterData: null, repeaterDataPropertyToShow: null, view: null };
        }
        this.property = this.data.settings.property;
        this.loadRepeaterData();
        let repeater = null;
        if (this.data.repeaters) {
            repeater = this.data.repeaters.find(_r => _r.id === this.data.settings.property.repeaterData);
        }
        this.repeaterDataCtrl.setValue(repeater);
    }

    onRepeaterDataChanged() {
        if (!this.data.settings.property) {
            this.data.settings.property = { repeaterData: null, repeaterDataPropertyToShow: null, view: null };
        }
        if (this.repeaterDataCtrl.value) {
            this.data.settings.property.repeaterData = this.repeaterDataCtrl.value.id;
        }
        this.onPropChanged.emit(this.data.settings);
    }

    onEditNewRepeaterData() {
        let dialogRef = this.dialog.open(RepeaterConfigComponent, {
            position: { top: '60px' },
            minWidth: '1090px', width: '1090px'
        });
        dialogRef.afterClosed().subscribe((result: IDataRepeaterDataResult) => {
            if (result) {
                this.data.repeaters = result.repeaters;
                this.loadRepeaterData();
                if (result.selected) {
                    this.repeaterDataCtrl.setValue(result.selected);
                }
                this.onRepeaterDataChanged();
            }
        });
    }

    private loadRepeaterData(toset?: string) {
        // load the initial repeater data list
        this.filteredRepeaterData.next(this.data.repeaters.slice());
        // listen for search field value changes
        this.repeaterDataFilterCtrl.valueChanges
            .pipe(takeUntil(this._onDestroy))
            .subscribe(() => {
                this.filterRepeaterData();
            });
        if (toset) {
            let idx = -1;
            this.data.repeaters.every(function(value, index, _arr) {
                if (value.id === toset) {
                    idx = index;
                    return false;
                }
                return true;
            });
            if (idx >= 0) {
                this.repeaterDataCtrl.setValue(this.data.repeaters[idx]);
            }
        }
    }

    private filterRepeaterData() {
        if (!this.data.repeaters) {
            return;
        }
        // get the search keyword
        let search = this.repeaterDataFilterCtrl.value;
        if (!search) {
            this.filteredRepeaterData.next(this.data.repeaters.slice());
            return;
        } else {
            search = search.toLowerCase();
        }
        // filter the variable
        this.filteredRepeaterData.next(
            this.data.repeaters.filter(repeaterData => repeaterData.name.toLowerCase().indexOf(search) > -1)
        );
    }
}
