import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild, Input } from '@angular/core';

import { Serie, UplotOptions } from './uplotOptions';

declare const uPlot: any;

@Component({
    selector: 'ngx-uplot',
    templateUrl: './ngx-uplot.component.html',
    styleUrls: ['./ngx-uplot.component.css']
})
export class NgxUplotComponent implements OnInit, AfterViewInit, OnDestroy {

    @Input() public id: string;
    @Input() public options: UplotOptions;
    @ViewChild('graph') public graph: ElementRef;
    
    data = [[]];
    // series = [{}];

    uplot: any;
    sampleData = [
        [1546300800, 1546387200],    // x-values (timestamps)
        [35, 71],    // y-values (series 1)
        [90, 15],    // y-values (series 2)
    ];
    sampleSerie = [
        {},
        {
            // initial toggled state (optional)
            show: true,
            spanGaps: false,
            // // in-legend display
            label: "Serie",
            value: (self, rawValue) => "$" + rawValue.toFixed(2),
            // // series style
            stroke: "red",
            width: 1,
            fill: "rgba(255, 0, 0, 0.3)",
            dash: [10, 5],
        }
    ];

    defOptions: UplotOptions = {
        title: "My Chart",
        id: "chart1",
        class: "my-chart",
        width: 800,
        height: 600,
        legend: { show: true, width: 1 },
        scales: {
            x: {
                time: true,
            },
        },
        series: this.sampleSerie,
    };

    constructor() { }

    ngOnInit() {
        this.uplot = new uPlot(this.defOptions, this.sampleData, this.graph.nativeElement);
    }

    ngAfterViewInit() {
    }

    ngOnDestroy() {
        try {
            this.uplot.destroy();
        } catch (e) {
            console.log(e);
        }
    }

    resize(height?, width?) {
        let chart = this.graph.nativeElement;        
        if (!height) { 
            height = chart.clientHeight;
        }
        if (!width) {
            width = chart.clientWidth;
        }
        this.uplot.setSize({height: height, width: width});
    }

    init(options?: UplotOptions) {
        this.data = [[]];
        // this.series = [{}];

        if (options) {
            this.options = options;
            if (!options.id) {
                this.data = this.sampleData;
                this.options.series = this.sampleSerie;
            }
        }
        let opt = this.options || this.defOptions;
        this.uplot.destroy();
        this.uplot = new uPlot(opt, this.data, this.graph.nativeElement);
    }

    addSerie(index: string, attribute: Serie) {
        this.uplot.addSeries(attribute, index);
        this.data.push([]);
    }

    setSample() {
        let sample = [[1546300800, 1546387200]];
        for (let i = 0; i < this.uplot.series.length; i++) {
            sample.push([Math.floor(Math.random() * 20), Math.floor(Math.random() * 30)]);
        }
        this.setData(sample);
    }

    setData(data = [[]]) {
        this.data = data;
        this.uplot.setData(this.data);
    }

	addValue(index, x, y) {
        let xpos = this.data[0].indexOf(x);
        if (xpos < 0) {
            this.data[0].push(x);
            for (let i = 0; i < this.data.length; i++) {
                if (this.data[i].length > 300) {
                    this.data[i].shift();
                }
                if (i === index) {
                    this.data[i].push(y);
                } else if (i) {
                    this.data[i].push(null);
                }
            }
        } else {
            this.data[index][xpos] = y;
        }
        this.uplot.setData(this.data);
    }

    redraw() {
        this.uplot.redraw();
    }
}
