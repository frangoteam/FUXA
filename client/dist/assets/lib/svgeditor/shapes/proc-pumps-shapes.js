
(function () {
    'use strict';
    var shapesGroupName = 'Proc. Eng. Pumps';
    var typeId = 'proceng';

    var shapes = [
        {
            name: 'centrifugal', ico: 'assets/lib/svgeditor/shapes/img/centrifugal.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 40,20 A 20,20 0 0 1 20,40 20,20 0 0 1 0,20 20,20 0 0 1 20,0 20,20 0 0 1 40,20' } },
                { id: '', type: 'path', attr: { d: 'M 20 0 L 20 40 M 0 20 L 20 0 L 40 20' } }]
        },
        {
            name: 'diaph', ico: 'assets/lib/svgeditor/shapes/img/diaph.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 40,20 A 20,20 0 0 1 20,40 20,20 0 0 1 0,20 20,20 0 0 1 20,0 20,20 0 0 1 40,20' } },
                { id: '', type: 'path', attr: { d: 'M 20 0 L 40 20 C 35.06 25.95 27.73 29.39 20 29.39 C 12.27 29.39 4.94 25.95 0 20 Z' } }]
        },
        {
            name: 'pumphidra', ico: 'assets/lib/svgeditor/shapes/img/pumphidra.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 40,20 A 20,20 0 0 1 20,40 20,20 0 0 1 0,20 20,20 0 0 1 20,0 20,20 0 0 1 40,20' } },
                { id: '', type: 'path', attr: { d: 'M 0 20 L 20 0 L 40 20' } }]
        },
        {
            name: 'pumpjet', ico: 'assets/lib/svgeditor/shapes/img/pumpjet.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 40,20 A 20,20 0 0 1 20,40 20,20 0 0 1 0,20 20,20 0 0 1 20,0 20,20 0 0 1 40,20' } },
                { id: '', type: 'path', attr: { d: 'M 0 20 L 20 0 L 40 20 M 8.8 11.2 C 14.87 18.58 14.87 29.22 8.8 36.6 M 31.2 11.2 C 25.13 18.58 25.13 29.22 31.2 36.6' } }]
        },
        {
            name: 'pumpgear', ico: 'assets/lib/svgeditor/shapes/img/pumpgear.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 40,20 A 20,20 0 0 1 20,40 20,20 0 0 1 0,20 20,20 0 0 1 20,0 20,20 0 0 1 40,20' } },
                { id: '', type: 'path', attr: { d: 'M 0 20 L 20 0 L 40 20' } },
                { id: '', type: 'path', attr: { d: 'm 20,20 a 6,6 0 0 1 -6,6 6,6 0 0 1 -6,-6 6,6 0 0 1 6,-6 6,6 0 0 1 6,6' } },
                { id: '', type: 'path', attr: { d: 'm 32,20 a 6,6 0 0 1 -6,6 6,6 0 0 1 -6,-6 6,6 0 0 1 6,-6 6,6 0 0 1 6,6' } }]
        },
        {
            name: 'motor', ico: 'assets/lib/svgeditor/shapes/img/motor-simb.svg', content: [
                { id: 'c', type: 'ellipse', attr: { cx: '20', cy: '20', rx: '20.5', ry: '20.5' } },
                { id: 's', type: 'path', attr: { d: 'M 20,1 40,20.25 20,39.5 Z', fill: '#000000' } }]
        },
        {
            name: 'pumpturbi', ico: 'assets/lib/svgeditor/shapes/img/pumpturbi.svg', content: [
                { id: '', type: 'path', attr: { d: 'M -0.38 17.23 L 6.67 17.23 L 6.67 11.75 L 69.33 0 L 69.33 17.23 L 76.38 17.23 L 76.38 29.77 L 69.33 29.77 L 69.33 47 L 6.67 35.25 L 6.67 29.77 L -0.38 29.77 Z M 6.67 17.23 L 6.67 29.77 M 69.33 17.23 L 69.33 29.77' } }]
        },
        {
            name: 'pumpcentri1', ico: 'assets/lib/svgeditor/shapes/img/pumpcentri1.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0.43 18.66 C 2.16 7.93 11.02 0.07 21.43 0 L 50 0 L 50 14.93 L 41.75 14.93 C 44.47 22.91 42.65 31.81 37.04 37.93 C 31.43 44.05 22.99 46.34 15.24 43.84 C 7.49 41.34 1.76 34.48 0.43 26.12' } }]
        },
        {
            name: 'pumpvacuum', ico: 'assets/lib/svgeditor/shapes/img/pumpvacuum.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0.5 20.49 L 13.68 20.49 L 13.68 13.35 L 24.68 13.35 C 28.3 5.24 36.47 0 45.5 0 C 54.53 0 62.7 5.24 66.32 13.35 L 77.32 13.35 L 77.32 20.49 L 90.5 20.49 L 90.5 24.06 L 77.32 24.06 L 77.32 31.2 L 66.32 31.2 C 62.7 39.31 54.53 44.55 45.5 44.55 C 36.47 44.55 28.3 39.31 24.68 31.2 L 13.68 31.2 L 13.68 24.06 L 0.5 24.06 Z' } },
                { id: '', type: 'path', attr: { d: 'M 13.68 20.49 L 13.68 24.06 M 77.32 20.49 L 77.32 24.06 M 24.68 31.2 C 22.15 25.51 22.15 19.04 24.68 13.35 M 66.32 13.35 C 68.85 19.04 68.85 25.51 66.32 31.2' } }]
        },
        {
            name: 'pumpcentri2', ico: 'assets/lib/svgeditor/shapes/img/pumpcentri2.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 49.57 17.86 C 47.84 7.6 38.98 0.06 28.57 0 L 0 0 L 0 14.29 L 8.25 14.29 C 5.53 21.93 7.35 30.45 12.96 36.31 C 18.57 42.17 27.01 44.35 34.76 41.96 C 42.51 39.57 48.24 33 49.57 25' } }]
        },        
        {
            name: 'pumpscreew', ico: 'assets/lib/svgeditor/shapes/img/pumpscreew.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 86.46 0 C 82.18 3.8 79.73 9.26 79.73 15 C 79.73 20.74 82.18 26.2 86.46 30 L 116.27 30 C 120.55 26.2 123 20.74 123 15 C 123 9.26 120.55 3.8 116.27 0 Z M 74.53 15 L 79.5 15 M 14.91 25 L 14.91 35 M 59.63 25 L 59.63 35' } },
                { id: '', type: 'path', attr: { d: 'M 0,5 H 74.529999 V 25 H 0 Z' } },
                { id: '', type: 'path', attr: { d: 'M 4.47 15 C 5.42 11.35 7.57 9 9.94 9 C 12.31 9 14.46 11.35 15.4 15 C 16.35 18.65 18.5 21 20.87 21 C 23.24 21 25.39 18.65 26.34 15 C 27.28 11.35 29.43 9 31.8 9 C 34.17 9 36.32 11.35 37.27 15 C 38.21 18.65 40.36 21 42.73 21 C 45.1 21 47.25 18.65 48.2 15 C 49.15 11.35 51.29 9 53.66 9 C 56.04 9 58.18 11.35 59.13 15 C 60.08 18.65 62.22 21 64.6 21 C 66.97 21 69.11 18.65 70.06 15 M 86.46 0 L 86.46 30 M 116.27 0 L 116.27 30' } }]
        }, 
        {
            name: 'pumpblower', ico: 'assets/lib/svgeditor/shapes/img/pumpblower.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 15.71 37.5 L 7.41 46.53 L 48.9 46.53 L 40.61 37.5' } },
                { id: '', type: 'path', attr: { d: 'M 0.5 0 L 28.16 0 C 37.18 0.07 45.13 5.98 47.81 14.63 C 50.5 23.28 47.31 32.68 39.93 37.89 C 32.54 43.09 22.65 42.91 15.47 37.43 C 8.28 31.95 5.44 22.43 8.45 13.89 L 0.5 13.72 Z' } },
                { id: '', type: 'path', attr: { d: 'M 35.074673,20.83 A 6.9146729,6.9447761 0 0 1 28.16,27.774776 6.9146729,6.9447761 0 0 1 21.245327,20.83 6.9146729,6.9447761 0 0 1 28.16,13.885224 6.9146729,6.9447761 0 0 1 35.074673,20.83' } }]
        },     
        {
            name: 'pumpgear2', ico: 'assets/lib/svgeditor/shapes/img/pumpgear2.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 13.16 71.93 L 6.58 79.82 L 43.42 79.82 L 36.75 71.93' } },
                { id: '', type: 'path', attr: { d: 'M 42.54 8.77 L 42.54 65.79 C 42.54 70.63 34.69 74.56 25 74.56 C 15.31 74.56 7.46 70.63 7.46 65.79 L 7.46 8.77 C 7.46 3.93 15.31 0 25 0 C 34.69 0 42.54 3.93 42.54 8.77 Z' } },
                { id: '', type: 'path', attr: { d: 'M 39.035088,52.630001 A 14.035088,14.034286 0 0 1 25,66.664287 14.035088,14.034286 0 0 1 10.964912,52.630001 14.035088,14.034286 0 0 1 25,38.595716 14.035088,14.034286 0 0 1 39.035088,52.630001' } },
                { id: '', type: 'path', attr: { d: 'M 39.035088,20.17 A 14.035088,14.034286 0 0 1 25,34.204286 14.035088,14.034286 0 0 1 10.964912,20.17 14.035088,14.034286 0 0 1 25,6.1357145 14.035088,14.034286 0 0 1 39.035088,20.17' } },
                { id: '', type: 'path', attr: { d: 'M 50 27.63 L 50 45.17 M 42.54 36.4 L 50 36.4 M 0 28.07 L 0 45.61 M 0 36.4 L 7.46 36.4' } }]
        },       
        {
            name: 'pumphorizo', ico: 'assets/lib/svgeditor/shapes/img/pumphorizo.svg', content: [
                { id: '', type: 'path', attr: { d: 'm 39.73,70.360001 h 2.74 V 79.56 h -2.74 z' } },
                { id: '', type: 'path', attr: { d: 'M 30.82 4.61 C 33.42 1.68 37.16 0 41.09 0 C 45.03 0 48.77 1.68 51.37 4.61 L 51.37 65.93 C 48.77 68.87 45.03 70.55 41.1 70.55 C 37.16 70.55 33.42 68.87 30.82 65.93 Z M 71.92 79.56 C 74.86 82.15 76.55 85.87 76.55 89.78 C 76.55 93.69 74.86 97.41 71.92 100 L 10.27 100 C 7.33 97.41 5.64 93.69 5.64 89.78 C 5.64 85.87 7.33 82.15 10.27 79.56 Z M 76.37 89.78 L 82.19 89.78 M 82.19 82.97 L 82.19 96.59 M 0 89.78 L 5.82 89.78 M 0 82.97 L 0 96.59 M 30.82 65.93 L 51.37 65.93 M 30.82 4.61 L 51.37 4.61' } }]
        },       
        {
            name: 'pumpscreew2', ico: 'assets/lib/svgeditor/shapes/img/pumpscreew2.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 8.57 38.01 L 0 47.16 L 42.86 47.16 L 34.29 38.01' } },
                { id: '', type: 'path', attr: { d: 'M 0.43 17.58 C 2.18 7.43 11.11 0 21.55 0 C 32 0 40.93 7.43 42.68 17.58 L 50 17.58 L 50 24.63 L 42.68 24.63 C 40.93 34.78 32 42.21 21.55 42.21 C 11.11 42.21 2.18 34.78 0.43 24.63' } }]
        },   
        {
            name: 'pumpperis', ico: 'assets/lib/svgeditor/shapes/img/pumpperis.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 9.6 45.08 L 0 55.48 L 48 55.48 L 38.4 45.08' } },
                { id: '', type: 'path', attr: { d: 'm 48,25.879999 a 24,24 0 0 1 -24,24 24,24 0 0 1 -24,-24 A 24,24 0 0 1 24,1.8799992 24,24 0 0 1 48,25.879999' } },
                { id: '', type: 'path', attr: { d: 'M 32,9.8800001 A 8,8 0 0 1 24,17.88 8,8 0 0 1 16,9.8800001 a 8,8 0 0 1 8,-8 8,8 0 0 1 8,8' } },
                { id: '', type: 'path', attr: { d: 'm 18.88,35.080002 a 8,8 0 0 1 -8,8 8,8 0 0 1 -7.9999999,-8 8,8 0 0 1 7.9999999,-8 8,8 0 0 1 8,8' } },
                { id: '', type: 'path', attr: { d: 'm 45.119999,35.080002 a 8,8 0 0 1 -8,8 8,8 0 0 1 -8,-8 8,8 0 0 1 8,-8 8,8 0 0 1 8,8' } },
                { id: '', type: 'path', attr: { d: 'M 17.04 6.04 L 3.68 31.48 M 30.96 6.04 L 44.32 31.48 M 10.88 43.08 L 37.12 43.08 M 16 0.28 L 16 9.88 M 32 0.28 L 32 9.88' } }]
        },          
        {
            name: 'pumpfeed', ico: 'assets/lib/svgeditor/shapes/img/pumpfeed.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0.5 0 L 52.5 0 L 52.5 8 L 80.5 8 L 80.5 24 L 52.5 24 L 52.5 32 L 0.5 32 Z' } }]
        }];

    // merge shapes groups        
    for (var i = 0; i < shapes.length; i++) {
        shapes[i].name = typeId + '-' + shapes[i].name;
    }
    if (svgEditor.shapesGrps[shapesGroupName]) {
        for (var i = 0; i < shapes.length; i++) {
            svgEditor.shapesGrps[shapesGroupName].push(shapes[i]);
        }
    } else {
        svgEditor.shapesGrps[shapesGroupName] = shapes;
    }
}());