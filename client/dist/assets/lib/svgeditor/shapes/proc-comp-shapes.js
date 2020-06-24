
(function () {
    'use strict';
    var shapesGroupName = 'Proc. Eng. Compressor';
    var typeId = 'proceng';

    var shapes = [
        {
            name: 'compvoid', ico: 'assets/lib/svgeditor/shapes/img/compressor-void.svg', content: [
                { id: '', type: 'path', attr: { d: 'm 10,3.3 28,8.4 m -28,26 28,-8.4 M 40,21 A 20,20 0 0 1 20,41 20,20 0 0 1 0,21 20,20 0 0 1 20,1 20,20 0 0 1 40,21 Z' } }]
        },
        {
            name: 'compfan', ico: 'assets/lib/svgeditor/shapes/img/compressor-fan.svg', content: [
                { id: '', type: 'path', attr: { d: 'm 17.41,14.62 c 2.15,2.52 3.49,4.91 2.99,5.34 -0.24,0.21 -0.88,-0.07 -1.79,-0.78 -0.9,-0.71 -1.99,-1.79 -3.02,-3 -2.15,-2.52 -3.49,-4.91 -2.99,-5.34 0.24,-0.21 0.88,0.07 1.79,0.78 0.9,0.71 1.99,1.79 3.02,3 z m -1.83,9.27 c 1.03,-1.22 2.11,-2.3 3,-3.02 0.9,-0.72 1.54,-1 1.78,-0.79 0.25,0.2 0.08,0.88 -0.48,1.88 -0.55,1.01 -1.43,2.26 -2.46,3.48 -1.03,1.22 -2.11,2.31 -3,3.02 -0.9,0.72 -1.54,1 -1.78,0.8 -0.25,-0.21 -0.08,-0.89 0.48,-1.89 0.55,-1.01 1.43,-2.26 2.46,-3.48 z M 33,20 A 6,1.2 0 0 1 27,21.2 6,1.2 0 0 1 21,20 6,1.2 0 0 1 27,18.8 6,1.2 0 0 1 33,20 M 10.5,2.8 l 28,8.4 m -28,26 28,-8.4 M 41,20 A 20,20 0 0 1 21,40 20,20 0 0 1 1,20 20,20 0 0 1 21,0 20,20 0 0 1 41,20 Z' } }]
        },
        {
            name: 'comppiston', ico: 'assets/lib/svgeditor/shapes/img/compressor-piston.svg', content: [
                { id: '', type: 'path', attr: { d: 'm 10,2.8 28,8.4 m -28,26 28,-8.4 M 14,20 h 12 m 0,-6 V 26 M 40,20 A 20,20 0 0 1 20,40 20,20 0 0 1 0,20 20,20 0 0 1 20,0 20,20 0 0 1 40,20 Z' } }]
        },
        {
            name: 'compring', ico: 'assets/lib/svgeditor/shapes/img/compring.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 40,20 A 20,20 0 0 1 20,40 20,20 0 0 1 0,20 20,20 0 0 1 20,0 20,20 0 0 1 40,20' } },
                { id: '', type: 'path', attr: { d: 'm 28,20 a 8,8 0 0 1 -8,8 8,8 0 0 1 -8,-8 8,8 0 0 1 8,-8 8,8 0 0 1 8,8' } },
                { id: '', type: 'path', attr: { d: 'M 10 2.8 L 38 11.2 M 10 37.2 L 38 28.8 M 13.76 9.6 L 15.92 13.2 M 13.76 30.4 L 15.92 26.8 M 26.24 30.4 L 24.08 26.8 M 26.24 9.6 L 24.08 13.2 M 8 20 L 12 20 M 28 20 L 32 20' } }]
        },
        {
            name: 'compejector', ico: 'assets/lib/svgeditor/shapes/img/compejector.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 40,20 A 20,20 0 0 1 20,40 20,20 0 0 1 0,20 20,20 0 0 1 20,0 20,20 0 0 1 40,20' } },
                { id: '', type: 'path', attr: { d: 'M 10 2.8 L 38 11.2 M 10 37.2 L 38 28.8 M 2.6 10 C 10.45 15.51 21.11 14.67 28 8 M 2.6 30 C 10.45 24.49 21.11 25.33 28 32' } }]
        },
        {
            name: 'compdiaph', ico: 'assets/lib/svgeditor/shapes/img/compdiaph.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 40,20 A 20,20 0 0 1 20,40 20,20 0 0 1 0,20 20,20 0 0 1 20,0 20,20 0 0 1 40,20' } },
                { id: '', type: 'path', attr: { d: 'M 10 2.8 L 38 11.2 M 10 37.2 L 38 28.8 M 10 2.8 C 4.82 13.68 4.82 26.32 10 37.2' } }]
        },
        {
            name: 'comprotary', ico: 'assets/lib/svgeditor/shapes/img/comprotary.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 40,20 A 20,20 0 0 1 20,40 20,20 0 0 1 0,20 20,20 0 0 1 20,0 20,20 0 0 1 40,20' } },
                { id: '', type: 'path', attr: { d: 'M 10 2.8 L 38 11.2 M 10 37.2 L 38 28.8 M 12 20 L 28 20 M 26 14.8 C 28.56 17.79 28.56 22.21 26 25.2 M 14 14.8 C 11.44 17.79 11.44 22.21 14 25.2' } }]
        },        
        {
            name: 'compscrew', ico: 'assets/lib/svgeditor/shapes/img/compscrew.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 40,20 A 20,20 0 0 1 20,40 20,20 0 0 1 0,20 20,20 0 0 1 20,0 20,20 0 0 1 40,20' } },
                { id: '', type: 'path', attr: { d: 'M 10 2.8 L 38 11.2 M 10 37.2 L 38 28.8 M 10 18 L 12 16 L 16 20 L 20 16 L 24 20 L 28 16 L 30 18 M 10 22 L 12 20 L 16 24 L 20 20 L 24 24 L 28 20 L 30 22' } }]
        },                
        {
            name: 'compair', ico: 'assets/lib/svgeditor/shapes/img/compair.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 7.79 25.33 L 92.21 25.33 C 100 37.64 100 53.17 92.21 65.48 L 7.79 65.48 C 0 53.17 0 37.64 7.79 25.33 Z' } },
                { id: '', type: 'path', attr: { d: 'M 7.9899998,25.33 H 91.809999 V 65.480001 H 7.9899998 Z' } },
                { id: '', type: 'path', attr: { d: 'm 40.186186,18.639999 a 3.9261878,3.8235295 0 0 1 -3.926188,3.82353 3.9261878,3.8235295 0 0 1 -3.926187,-3.82353 3.9261878,3.8235295 0 0 1 3.926187,-3.823529 3.9261878,3.8235295 0 0 1 3.926188,3.823529' } },
                { id: '', type: 'path', attr: { d: 'M 74.052372,15.77 A 7.8523755,7.647059 0 0 1 66.199997,23.417059 7.8523755,7.647059 0 0 1 58.347621,15.77 7.8523755,7.647059 0 0 1 66.199997,8.1229415 7.8523755,7.647059 0 0 1 74.052372,15.77' } },
                { id: '', type: 'path', attr: { d: 'M 35.4 14.91 L 64.09 8.53 M 36.29 22.6 L 66.05 23.49 M 17.12 25.33 L 17.12 21.03 M 12.7 21.03 L 17.12 16.25 M 17.12 0.48 L 17.12 16.25 M 13.68 8.51 L 20.75 14.53 M 14.66 5.93 L 20.26 10.52 M 15.25 3.35 L 19.57 7.17 M 86.81 25.33 L 86.81 21.99' } },
                { id: '', type: 'path', attr: { d: 'M 12.7 11.95 L 22.03 21.03 L 12.7 21.03 Z M 83.86 11.95 L 89.75 11.95 L 83.86 21.99 L 89.75 21.99 Z' } }]
        },
        {
            name: 'compreci', ico: 'assets/lib/svgeditor/shapes/img/compreci.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 14.8 39.98 L 14.8 -0.02 L 35.2 -0.02 L 35.2 12.98 L 76.02 12.98 L 76.02 39.98 Z' } },
                { id: '', type: 'path', attr: { d: 'm 0,22.98 h 14.29 v 4 H 0 Z' } },
                { id: '', type: 'path', attr: { d: 'M 76.02 22.98 L 89.29 22.98 L 89.29 21.48 L 100 24.98 L 89.29 28.48 L 89.29 26.98 L 76.02 26.98 Z' } }]
        },
        {
            name: 'compreci2', ico: 'assets/lib/svgeditor/shapes/img/compreci2.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0,0 H 40 V 40 H 0 Z' } },
                { id: '', type: 'path', attr: { d: 'M 0 18.4 L 40 18.4 M 0 21.6 L 40 21.6 M 20 21.6 L 20 52' } }]
        },
        {
            name: 'compsilence', ico: 'assets/lib/svgeditor/shapes/img/compsilence.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 39.5 74.52 L 35.5 80.48 L 55.5 80.48 L 51.5 74.52 M 20.5 6 L 20.5 70.55 C 20.5 73.6 16.02 76.07 10.5 76.07 C 4.98 76.07 0.5 73.6 0.5 70.55 L 0.5 6 C 0.5 2.95 4.98 0.48 10.5 0.48 C 16.02 0.48 20.5 2.95 20.5 6 Z M 70.5 6 L 70.5 70.55 C 70.5 73.6 74.98 76.07 80.5 76.07 C 86.02 76.07 90.5 73.6 90.5 70.55 L 90.5 6 C 90.5 2.95 86.02 0.48 80.5 0.48 C 74.98 0.48 70.5 2.95 70.5 6 Z' } },
                { id: '', type: 'path', attr: { d: 'M 55.5 35.79 L 55.5 70.55 C 55.5 73.6 51.02 76.07 45.5 76.07 C 39.98 76.07 35.5 73.6 35.5 70.55 L 35.5 35.79 C 35.5 32.75 39.98 30.28 45.5 30.28 C 51.02 30.28 55.5 32.75 55.5 35.79 Z' } },
                { id: '', type: 'path', attr: { d: 'm 53.5,63.599998 a 8,7.9443893 0 0 1 -8,7.94439 8,7.9443893 0 0 1 -8,-7.94439 8,7.9443893 0 0 1 8,-7.944389 8,7.9443893 0 0 1 8,7.944389' } },
                { id: '', type: 'path', attr: { d: 'm 53.5,43.740002 a 8,7.9443893 0 0 1 -8,7.944389 8,7.9443893 0 0 1 -8,-7.944389 8,7.9443893 0 0 1 8,-7.94439 8,7.9443893 0 0 1 8,7.94439' } },
                { id: '', type: 'path', attr: { d: 'M 20.5 53.67 L 35.5 53.67 M 55.5 53.67 L 70.5 53.67' } },
                { id: '', type: 'path', attr: { d: 'M 28 45.72 L 28 61.61 M 63 45.72 L 63 61.61' } }]
        },
        {
            name: 'compturbo', ico: 'assets/lib/svgeditor/shapes/img/compturbo.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 65.82 2.09 L 89.29 2.09 L 89.29 0 L 100 4.7 L 89.29 9.4 L 89.29 7.31 L 70.92 7.31 L 70.92 27.16 L 65.82 26.12 Z M 25 17.76 L 76.02 28.21 L 76.02 59.55 L 25 70 Z M 19.9 33.43 L 19.9 54.33 L 0.51 49.1 L 0.51 38.66 Z M 0 2.09 L 40.31 2.09 L 40.31 20.9 L 35.2 19.85 L 35.2 7.31 L 0 7.31 Z' } },
                { id: '', type: 'path', attr: { d: 'M 19.9 40.75 L 25 40.75 M 19.9 47.01 L 25 47.01' } }]
        },
        {
            name: 'comprotary2', ico: 'assets/lib/svgeditor/shapes/img/comprotary2.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 7.5 82 L 0 91 L 42 91 L 34.4 82' } },
                { id: '', type: 'path', attr: { d: 'M 41 10 L 41 75 C 41 80.52 32.05 85 21 85 C 9.95 85 1 80.52 1 75 L 1 10 C 1 4.48 9.95 0 21 0 C 32.05 0 41 4.48 41 10 Z' } },
                { id: '', type: 'path', attr: { d: 'M 37,23 A 16,16 0 0 1 21,39 16,16 0 0 1 5,23 16,16 0 0 1 21,7 16,16 0 0 1 37,23' } },
                { id: '', type: 'path', attr: { d: 'M 37,60 A 16,16 0 0 1 21,76 16,16 0 0 1 5,60 16,16 0 0 1 21,44 16,16 0 0 1 37,60' } }]
        },
        {
            name: 'compring2', ico: 'assets/lib/svgeditor/shapes/img/compring2.svg', content: [
                { id: '', type: 'path', attr: { d: 'm 60.5,30 a 30,30 0 0 1 -30,30 30,30 0 0 1 -30,-30 30,30 0 0 1 30,-30 30,30 0 0 1 30,30' } },
                { id: '', type: 'path', attr: { d: 'M 30.5 3.33 C 37.29 10.93 37.29 22.41 30.5 30 C 23.71 37.59 23.71 49.07 30.5 56.67 M 49.37 11.13 C 48.8 21.31 40.68 29.44 30.5 30 C 20.32 30.56 12.2 38.69 11.63 48.87 M 57.17 30 C 49.57 36.79 38.09 36.79 30.5 30 C 22.91 23.21 11.43 23.21 3.83 30 M 49.37 48.87 C 39.19 48.3 31.06 40.18 30.5 30 C 30 19.72 21.78 11.5 11.5 11' } },
                { id: '', type: 'path', attr: { d: 'm 32.5,30 a 2,2 0 0 1 -2,2 2,2 0 0 1 -2,-2 2,2 0 0 1 2,-2 2,2 0 0 1 2,2' } }]
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