
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

'use strict';

const width = 1200; //px
const height = 900; //px
const backgroundColour = 'white';
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, backgroundColour });

const createImage = async (file) => {
    const configuration = {
        type: 'line',
        data: {
            labels: ['Standing costs', 'Running costs'],
            datasets: [{
                label: 'Washing and cleaning',
                data: [0, 8],
                backgroundColor: '#22aa99'
            }, {
                label: 'Traffic tickets',
                data: [0, 2],
                backgroundColor: '#994499'
            }, {
                label: 'Tolls',
                data: [0, 1],
                backgroundColor: '#316395'
            }, {
                label: 'Parking',
                data: [5, 2],
                backgroundColor: '#b82e2e'
            }, {
                label: 'Car tax',
                data: [0, 1],
                backgroundColor: '#66aa00'
            }]
        },
        options: {
            responsive: false,
            legend: {
                position: 'right'
            },
            scales: {
                xAxes: [{
                    stacked: true
                }],
                yAxes: [{
                    stacked: true
                }]
            }
        }
    };

    return await chartJSNodeCanvas.renderToBuffer(configuration);
}

module.exports = {
    createImage   //for exporting to another file
}