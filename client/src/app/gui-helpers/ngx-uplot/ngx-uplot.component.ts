import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild, Input } from '@angular/core';

import { Series, Options } from './uPlot';

declare const uPlot: any;
declare const placement: any;

@Component({
    selector: 'ngx-uplot',
    templateUrl: './ngx-uplot.component.html',
    styleUrls: ['./ngx-uplot.component.css']
})
export class NgxUplotComponent implements OnInit, AfterViewInit, OnDestroy {

    @Input() public id: string;
    @Input() public options: Options;
    @ViewChild('graph') public graph: ElementRef;

    uplot: any;
    data: number[][];
    xtime = [new Date().getTime() / 1000 - 1, new Date().getTime() / 1000];     // start and sample x time
    sampleData = [this.xtime, [35, 71]];
    
    fmtDate = uPlot.fmtDate("{DD}/{MM}/{YY} {HH}:{mm}:{ss}");

    sampleSerie = [
        {},
        {
            // initial toggled state (optional)
            show: true,
            spanGaps: false,
            // // in-legend display
            label: "Serie",
            value: (self, rawValue) => rawValue.toFixed(this.options.decimalsPrecision),
            // // series style
            stroke: "red",
            width: 1,
            fill: "rgba(255, 0, 0, 0.3)",
            dash: [10, 5],
        }
    ];

    defOptions: Options = {
        title: "Default Chart",
        id: "defchart",
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
        this.options = this.defOptions;
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
        // this.uplot.redraw(false, true);
    }

    init(options?: Options) {
        this.data = [[]];
        if (options) {
            this.options = options;
            if (!options.id) {
                this.data = this.sampleData;
                this.options.series = this.sampleSerie;
            } else {
                // this.data = this.sampleData;
                this.data = [this.xtime];
            }
        }
        let opt = this.options || this.defOptions;
        if (this.uplot) {
            this.uplot.destroy();
        }
       opt.plugins = (this.options.tooltip && this.options.tooltip.show) ? [this.tooltipPlugin()] : [];

        this.uplot = new uPlot(opt, this.data, this.graph.nativeElement);
    }

    setOptions(options: Options) {
        this.options = options;
        this.init(this.options);
    }

    addSerie(index: string, attribute: Series) {
        this.data.push([null,null]);
        this.uplot.addSeries(attribute, index);
        this.uplot.setData(this.data);
    }

    setSample() {
        let sample = [this.xtime];
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

    redraw(flag: boolean = false) {
        this.uplot.redraw(flag);
    }

    checkAxisOptions() {

    }

    tooltipPlugin(opts: any = null) {
        let over, bound, bLeft, bTop;
        function syncBounds() {
            let bbox = over.getBoundingClientRect();
            bLeft = bbox.left;
            bTop = bbox.top;
        }

        const overlay = document.createElement("div");
        overlay.id = "overlay";
        overlay.style.display = "none";
        overlay.style.position = "absolute";
        document.body.appendChild(overlay);

        return {
            hooks: {
                init: u => {
                    over = u.root.querySelector(".u-over");

                    bound = over;
                    //	bound = document.body;

                    over.onmouseenter = () => {
                        overlay.style.display = "block";
                    };

                    over.onmouseleave = () => {
                        overlay.style.display = "none";
                    };
                },
                setSize: u => {
                    syncBounds();
                },
                setCursor: u => {
                    const { left, top, idx } = u.cursor;
                    const x = u.data[0][idx];
                    const y = u.data[1][idx];
                    const anchor = { left: left + bLeft, top: top + bTop };
                    const time = this.fmtDate(new Date(x * 1e3));
                    const xdiv = `<div class="ut-head">${u.series[0].label}: ${time}</div>`;
                    let series = '';
                    for (let i = 1; i < u.series.length; i++) {
                        const value = (u.data[i][idx]) ? u.data[i][idx].toFixed(this.options.decimalsPrecision) : '';
                        series = series + `<div class="ut-serie"><div class="ut-marker" style="border-color: ${u.series[i]._stroke}"></div>${u.series[i].label}: <div class="ut-value">${value}</div></div>`;
                    }
                    overlay.innerHTML = xdiv + series;// + `${x},${y} at ${Math.round(left)},${Math.round(top)}`;
                    placement(overlay, anchor, "right", "start", { bound });
                }
            }
        };
    }
}

export interface NgxOptions extends Options {
}

export interface NgxSeries extends Series {
}