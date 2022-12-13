
export enum GaugeType {
    Gauge,
    Donut,
    Zones
}

export class GaugeOptions {
    minValue = 0;
    maxValue = 3000;
    animationSpeed = 40;
    colorStart = '#6fadcf';
    colorStop = '#6fadcf';
    gradientType = '';
    strokeColor?: string = '#e0e0e0';
    pointer? = {
        length: 0.5,
        strokeWidth: 0.035,
        iconScale: 1.0,
        color: '#000000'
    };
    angle = -0.2;
    lineWidth = 0.2;
    radiusScale = 0.9;
    fontSize = 18;
    fontFamily: 'Sans-serif';
    textFilePosition = 30;
    limitMax = false;
    limitMin = false;
    highDpiSupport = true;
    backgroundColor = 'rgba(255, 255, 255, 0)';
    shadowColor?: string = '#d5d5d5';

    fractionDigits = 0;
    ticksEnabled = true;
    renderTicks = {
        divisions: 5,
        divWidth: 1.1,
        divLength: 0.7,
        divColor: '#333333',
        subDivisions: 3,
        subLength: 0.5,
        subWidth: 0.6,
        subColor: '#666666'
    };

    staticLabelsText = '200;500;2100;2800';
    staticFontSize = 10;
    staticFontColor = '#000000';
    staticLabels? = {
        font: '10px sans-serif',
        labels: [200, 500, 2100, 2800],
        fractionDigits: 0,
        color: '#000000'
    };
    staticZones? = [
         {strokeStyle: '#F03E3E', min: 0, max: 200},
         {strokeStyle: '#FFDD00', min: 200, max: 500},
         {strokeStyle: '#3F4964', min: 500, max: 2100},
         {strokeStyle: '#FFDD00', min: 2100, max: 2800},
         {strokeStyle: '#F03E3E', min: 2800, max: 3000}
    ];
}
