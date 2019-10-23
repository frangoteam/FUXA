import { Component, Input, Output, ElementRef, OnInit, AfterViewInit, OnChanges, ViewChild, SimpleChanges, EventEmitter } from '@angular/core';
import { DygraphOptions } from './dygraphOptions';

declare const Dygraph: any;
@Component({
    selector: 'ngx-dygraphs',
    templateUrl: './ngx-dygraphs.component.html',
    styleUrls: ['./ngx-dygraphs.component.css']
})
/**
 * Wrapper arround Dygraphs
 *
 * @class NgDygraphsComponent
 */
export class NgxDygraphsComponent implements OnInit, AfterViewInit, OnChanges {
    @Input() public options: DygraphOptions;
    @Input() public data: any;
    @Input() public noDataLabel: string;
    @Output() onTimeRange: EventEmitter<string> = new EventEmitter();
    @ViewChild('chart') public chart: ElementRef;

    public loadingInProgress: boolean;
    public withToolbar = false;
    public isEditor = false;
    public rangeType: any;
    public rangeTypeValue: any;

    //   public chartWidth: number;
    //   public chartHeight: number;
    mapData = {};

    public dygraph: any;
    public defOptions = {
        // width: "auto",
        // height: "auto",
        labels: ['Date', 'Temperature'],
        colors: [],
        // xlabel: "X label text",
        // ylabel: "Y label text",
        title: 'My Title',
        animatedZooms: true,
        connectSeparatedPoints: true,
        legend: 'always',
        labelsSeparateLines: true,
        // pointSize: 2,
        titleHeight: 20,
        axisLabelFontSize: 12
    };
    public sampleData = [[new Date('1967/09/14'), 0], [new Date('1968/09/14'), 1]];
    public ngOnInit() {
        this.options = Object.assign(this.defOptions, this.options);
        this.noDataLabel = this.noDataLabel || 'NO DATA AVAILABLE';
        // this.chartWidth = (this.options && this.options.width) || 380;
        // this.chartHeight = (this.options && this.options.height) || 240;
    }

    ngAfterViewInit() {
        this.data = this.sampleData;
        this.dygraph = new Dygraph(this.chart.nativeElement, this.data, this.options);
        this.loadingInProgress = false;
        this.dygraph.ready(graph => {
            let sc: SimpleChanges = {};
            this.ngOnChanges(sc);
            // test to change css legend
            var cols: any = document.getElementsByClassName('dygraph-legend');
            for(let i = 0; i < cols.length; i++) {
              cols[i].style.fontSize = '12px';
            }
        });
    }

    /**
     * ngOnChanges
     * @method ngOnChanges
     * @return {void}
     */
    public ngOnChanges(changes: SimpleChanges) {
        if (!changes) {
            return;
        }

        if (!this.data || !this.data.length) {
            this.loadingInProgress = false;
            return;
        }

        this.loadingInProgress = true;
        const options = Object.assign({}, this.options);

        // if (!options.width) {
        //   options.width = this.chartWidth;
        // }
        // if (!options.height) {
        //   options.height = this.chartHeight;
        // }
        if (!options.legend) {
            options.legend = 'always';
        }

        // this.resize();
        // setTimeout(() => {
        //   this.dygraph = new Dygraph(this.chart.nativeElement, this.data, options);
        //   this.loadingInProgress = false;
        //   this.dygraph.ready(graph => {
        //     this.watchRangeSelector(graph);
        //   });
        // }, 500);
    }

    onClick(ev) {
        this.onTimeRange.emit(ev);
    }

    onRangeChange(ev) {
        this.onTimeRange.emit(ev);
    }

    // public setData(data) {
    //     let sc: SimpleChanges = {};
    //     let rdata = [[new Date("1967/09/14"), 4], [new Date("1968/09/14"), 0]];
    //     this.dygraph.updateOptions({ file: rdata });
    // }

    public resize(height?, width?) {
        let chart = this.chart.nativeElement;
        let w = chart.parentNode.clientWidth;
        let h = chart.parentNode.clientHeight;
        if (height) {
            h = height;
        }
        if (width) {
            w = width;
        }
        chart.style.height = h + 'px';
        chart.style.width = w + 'px';
        this.dygraph.updateOptions({ height: h, width: w });
        this.dygraph.resize(width, height);
    }

    public changeVisibility(index, value) {
        this.dygraph.setVisibility(index, value);
    }

    public init() {
        this.options.labels = ['DateTime'];
        this.mapData = {};
        this.data = [];
    }

    public setOptions(options) {
        try {
            this.options = Object.assign(this.options, options);
            this.dygraph.updateOptions(this.options);
        } catch (e) {
        }
    }

    public addLine(id: string, name:string, color: string) {
        if (!this.mapData[id]) {
            this.mapData[id] = this.options.labels.length;
            this.options.labels.push(name);
            this.options.colors.push(color);
            this.dygraph.updateOptions({ labels: this.options.labels, colors: this.options.colors });
        }
    }

    public addValue(id: string, value) {
        // console.log(value);
        if (this.mapData[id] && value) {
            let row = Array(this.options.labels.length).fill(null);
            row[0] = new Date();
            row[this.mapData[id]] = parseInt(value);
            this.data.push(row);
            // check to remove old value
            if (this.data.length > 5000) {
                this.data.shift();
            }
            this.dygraph.updateOptions({ file: this.data });
        }
    }

    public clear() {
        this.data = [];
        this.dygraph.updateOptions({ file: this.data });
    }

    //   private watchRangeSelector(graph) {
    //     const observer = new MutationObserver(function(mutations) {
    //       // called on style changes of range selector handles
    //       if (mutations.length === 2) {
    //         // both range selector handles have style changed -> assume move
    //         // Zoom to the same zoom to trigger zoomCallback
    //         const zoomCallback = graph.getFunctionOption("zoomCallback");
    //         const [minX, maxX] = graph.xAxisRange();
    //         zoomCallback.call(graph, minX, maxX, graph.yAxisRanges());
    //       }
    //     });
    //     Array.from(
    //       document.getElementsByClassName("dygraph-rangesel-zoomhandle")
    //     ).forEach(
    //       // work on range selector handles
    //       function(element, idx, arr) {
    //         // watch for style changes
    //         observer.observe(element, {
    //           attributes: true,
    //           attributeFilter: ["style"]
    //         });
    //       }
    //     );
    //   }
}
