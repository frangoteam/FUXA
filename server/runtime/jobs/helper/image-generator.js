
'use strict';

const width = 1200; //px
const height = 900; //px
const backgroundColour = 'white';
var timeFormat = 'moment.ISO_8601';

const createImage = async (chartItem, chartValues) => {
    var ChartJSNodeCanvas;
    try {
        const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
        const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, backgroundColour });

        let datasets = [];
        chartItem.chart.lines.forEach(line => {
            datasets.push({
                label: line.label, 
                borderColor: line.color,
                data: chartValues[line.id],
                fill: (line.fill) ? true : false,
                backgroundColor: line.fill,
                borderWidth: 1
            });
        });
        const configuration = {
            type: 'line',
            data: {
                labels: [],
                datasets: datasets,
            },
            options: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        fontSize: chartItem.size || 14
                    }
                },
                elements: {
                    point:{
                        radius: 0
                    }
                },
                scales: {
                xAxes: [{
                    type: 'time',
                    fontSize: 20,
                    time: {
                        unit: 'day',
                        unitStepSize: 1,
                        displayFormats: {
                        'day': 'DD/MM/YYYY'
                        }
                    },
                    displayFormats: {
                        year: 'YYYY'
                    },
                    scaleLabel: {
                        display: false,
                        labelString: 'Date',
                    },
                    ticks: {
                        fontSize: chartItem.size || 14
                    }
                }],
                yAxes: [{
                    ticks: {
                        fontSize: chartItem.size || 14
                    }
                }],
                title: {
                    display: false,
                }
                }
            }
        };

        return await chartJSNodeCanvas.renderToBuffer(configuration);
    } catch {}
    return null;
}

module.exports = {
    createImage   //for exporting to another file
}