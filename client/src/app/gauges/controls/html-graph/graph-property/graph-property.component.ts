import { Component, Inject, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { FormControl } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { Subject, ReplaySubject } from 'rxjs';

import { TranslateService } from '@ngx-translate/core';

import { Graph, GraphSource, GraphType, GraphBarProperty, GraphBarXType } from '../../../../_models/graph';
import { GraphConfigComponent } from '../../../../editor/graph-config/graph-config.component';

@Component({
    selector: 'app-graph-property',
    templateUrl: './graph-property.component.html',
    styleUrls: ['./graph-property.component.css']
})
export class GraphPropertyComponent implements OnInit, AfterViewInit {

    graphBarType = GraphType.bar;
    graphType: GraphType = GraphType.pie;

    graphCtrl: FormControl = new FormControl();
    graphFilterCtrl: FormControl = new FormControl();
    public filteredGraph: ReplaySubject<Graph[]> = new ReplaySubject<Graph[]>(1);

    private _onDestroy = new Subject<void>();

    constructor(
        public dialog: MatDialog,
        public dialogRef: MatDialogRef<GraphPropertyComponent>,
        private translateService: TranslateService,
        @Inject(MAT_DIALOG_DATA) public data: any) { 
            if (this.data.settings.type.endsWith('bar')) {
                this.graphType = GraphType.bar;
            }
        }

    ngOnInit() {
        this.loadGraphs();
    }

    ngAfterViewInit() {

    }

    ngOnDestroy() {
        this._onDestroy.next();
        this._onDestroy.complete();
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
    }

    onTabChanged() {
    }

    onEditNewGraph() {
        let dialogRef = this.dialog.open(GraphConfigComponent, {
            position: { top: '60px' },
            minWidth: '1090px', width: '1090px',
            data: { type: (this.graphType === GraphType.bar) ? 'bar' : 'pie' }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.data.graphs = result;
                this.loadGraphs();
            }
        });
    }

    private loadGraphs(toset?: string) {
        // load the initial graph list
        this.filteredGraph.next(this.data.graphs.slice());
        // listen for search field value changes
        this.graphFilterCtrl.valueChanges
            .pipe(takeUntil(this._onDestroy))
            .subscribe(() => {
                this.filterGraph();
            });
        if (toset) {
            let idx = -1;
            this.data.graphs.every(function (value, index, _arr) {
                if (value.id === toset) {
                    idx = index;
                    return false;
                }
                return true;
            });
            if (idx >= 0) {
                this.graphCtrl.setValue(this.data.graphs[idx]);
            }
        }
    }

    private filterGraph() {
        if (!this.data.graphs) {
            return;
        }
        // get the search keyword
        let search = this.graphFilterCtrl.value;
        if (!search) {
            this.filteredGraph.next(this.data.graphs.slice());
            return;
        } else {
            search = search.toLowerCase();
        }
        // filter the variable
        this.filteredGraph.next(
            this.data.graphs.filter(graph => graph.name.toLowerCase().indexOf(search) > -1)
        );
    }
}
