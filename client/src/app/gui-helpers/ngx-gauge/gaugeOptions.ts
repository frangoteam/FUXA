
export enum GaugeType {
    Gauge,
    Donut,
    Zones
}

export class GaugeOptions {
    minValue: number = 0;
    maxValue: number = 3000;
    animationSpeed: number = 40;
    colorStart: string = '#6fadcf';
    colorStop: string = '#6fadcf';
    gradientType: string = '';
    strokeColor?: string = '#e0e0e0';
    pointer? = {
        length: 0.5,
        strokeWidth: 0.035,
        iconScale: 1.0,
        color: '#000000'
    };
    angle: number = 0;
    lineWidth: number = 0.3;
    radiusScale: number = 0.6;
    fontSize: number = 18;
    fontFamily: 'Sans-serif';
    textFilePosition: number = 20;
    limitMax: boolean = false;
    limitMin: boolean = false;
    highDpiSupport: boolean = true;
    backgroundColor: string = 'rgba(255, 255, 255, 0)';
    shadowColor?: string = '#d5d5d5';
    
    fractionDigits: number = 0;
    ticksEnabled: boolean = true;
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

    staticLabelsText: string = '200;500;2100;2800';
    staticFontSize: number = 10;
    staticFontColor: string = '#000000';
    staticLabels? = {
        font: '10px sans-serif',
        labels: [200, 500, 2100, 2800],
        fractionDigits: 0,
        color: '#000000'
    };
    staticZones? = [
         {strokeStyle: "#F03E3E", min: 0, max: 200},
         {strokeStyle: "#FFDD00", min: 200, max: 500},
         {strokeStyle: "#30B32D", min: 500, max: 2100},
         {strokeStyle: "#FFDD00", min: 2100, max: 2800},
         {strokeStyle: "#F03E3E", min: 2800, max: 3000}
    ]
}