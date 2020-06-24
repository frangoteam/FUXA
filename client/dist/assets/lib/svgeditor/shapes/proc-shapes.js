
// add the shape library: with file name as parameter (have to be unique)
(function () {
    'use strict';
    var shapesGroupName = 'Proc. Eng.'; // used to organize and gropping the shapes, displayed in editor menu as label with expand/collapse 
    var typeId = 'proceng';          // used to identify shapes type, 'proc-eng' is binded with angular component 'ProcEngComponent'
    // if you make a new type you have to implement the angular component too 

    // add in this array your schapes data, the shape object has the following attributes:
    // 'name': is unique for shape type
    // 'ico': path icon displayed in editor menu
    // 'content': array of svg element 
    // 'id': element id used if you like make a animation managed in angular component
    // 'type': svg element type (path, text, circle,...) see svg description
    // 'attr': element attribute, depending of type

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
        },
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
        },
        {
            name: 'valveax', ico: 'assets/lib/svgeditor/shapes/img/valve-ax.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 0 L 20 12 L 0 24 Z M 40 0 L 20 12 L 40 24 Z' } }]
        },
        {
            name: 'valvebx', ico: 'assets/lib/svgeditor/shapes/img/valve-bx.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 20 12 L 40 0 L 40 24 Z M 20 12 L 32 32 L 8 32 Z' } }]
        },
        {
            name: 'valvecx', ico: 'assets/lib/svgeditor/shapes/img/valve-cx.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 0 L 20 12 L 0 24 Z M 40 0 L 20 12 L 40 24 Z M 20 12 L 32 32 L 8 32 Z' } }]
        },
        {
            name: 'exchtube', ico: 'assets/lib/svgeditor/shapes/img/exchanger-tube.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 7.04,0 V 40 M 80.96,0 V 40 M 7.04,5 H 80.96 M 7.04,10 H 80.96 M 7.04,15 H 80.96 M 7.04,20 H 80.96 M 7.04,25 H 80.96 M 7.04,30 H 80.96 M 7.04,35 H 80.96 M 0,0 H 88 V 40 H 0 Z' } }]
        },        
        {
            name: 'agitator-prop', ico: 'assets/lib/svgeditor/shapes/img/agitator-prop.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 30 0 L 30 78.2 M 49.41 71.68 C 52.4 70.31 55.93 71.17 57.97 73.77 C 60 76.37 60 80.03 57.97 82.64 C 55.93 85.24 52.4 86.1 49.41 84.72 L 10.59 71.68 C 7.6 70.31 4.07 71.17 2.03 73.77 C 0 76.37 0 80.03 2.03 82.64 C 4.07 85.24 7.6 86.1 10.59 84.72 Z' } }]
        },
        {
            name: 'agitator-turbo', ico: 'assets/lib/svgeditor/shapes/img/agitator-turbo.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 30 0 L 30 68.12' } },
                { id: '', type: 'path', attr: { d: 'M 0,68.120003 H 15 V 87.580002 H 0 Z' } },
                { id: '', type: 'path', attr: { d: 'M 45,68.120003 H 60 V 87.580002 H 45 Z' } },
                { id: '', type: 'path', attr: { d: 'M 15,68.120003 H 30 V 87.580002 H 15 Z' } },
                { id: '', type: 'path', attr: { d: 'M 30,68.120003 H 45 V 87.580002 H 30 Z' } }]
        },
        {
            name: 'agitator-disc', ico: 'assets/lib/svgeditor/shapes/img/agitator-disc.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 30 0 L 30 77.85 M 15 77.85 L 45 77.85' } },
                { id: '', type: 'path', attr: { d: 'M 0,68.120003 H 15 V 87.580002 H 0 Z' } },
                { id: '', type: 'path', attr: { d: 'M 45,67.790001 H 60 V 87.25 H 45 Z' } }]
        },
        {
            name: 'agitator-paddle', ico: 'assets/lib/svgeditor/shapes/img/agitator-paddle.svg', content: [
                { id: '', type: 'path', attr: { d: 'm 0,59.790001 h 60 v 30 H 0 Z' } },
                { id: '', type: 'path', attr: { d: 'M 30 -0.21 L 30 59.79 M 0 89.79 L 30 59.79 L 30 89.79 L 60 59.79' } }]
        },
        {
            name: 'centrifuge1', ico: 'assets/lib/svgeditor/shapes/img/centrifuge1.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 6,0 H 66 V 60 H 6 Z' } },
                { id: '', type: 'path', attr: { d: 'M 60 6 L 12 6 L 12 54 L 60 54 M 0 30 L 60 30 M 18 30 L 27 15 L 45 45 L 54 30' } }]
        },
        {
            name: 'centrifuge2', ico: 'assets/lib/svgeditor/shapes/img/centrifuge2.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0,0 H 60 V 60 H 0 Z' } },
                { id: '', type: 'path', attr: { d: 'M 21 15 L 6 54 L 54 54 L 39 15 M 30 54 L 30 66' } }]
        },
        {
            name: 'centrifuge3', ico: 'assets/lib/svgeditor/shapes/img/centrifuge3.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0,0 H 60 V 60 H 0 Z' } },
                { id: '', type: 'path', attr: { d: 'M 30 54 L 30 66 M 6 6 L 6 54 L 54 54 L 54 6' } }]
        },
        {
            name: 'centrifuge4', ico: 'assets/lib/svgeditor/shapes/img/centrifuge4.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0,0 H 60 V 60 H 0 Z' } },
                { id: '', type: 'path', attr: { d: 'M 30 6 L 30 66 M 6 54 L 54 54 M 6 21 L 30 6 L 54 21 M 6 30 L 30 15 L 54 30' } }]
        },
        {
            name: 'crusher1', ico: 'assets/lib/svgeditor/shapes/img/crusher1.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 0 L 80 0 L 64 48 L 16 48 Z' } },
                { id: '', type: 'path', attr: { d: 'M 16 0 L 16 48 M 64 0 L 64 48' } }]
        },        
        {
            name: 'crusher2', ico: 'assets/lib/svgeditor/shapes/img/crusher2.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 0 L 80 0 L 64 48 L 16 48 Z' } },
                { id: '', type: 'path', attr: { d: 'M 16 0 L 16 48 M 64 0 L 64 48 M 24 36 L 32 8 L 48 8 L 56 36 Z' } }]
        },
        {
            name: 'crusher3', ico: 'assets/lib/svgeditor/shapes/img/crusher3.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 0 L 80 0 L 64 48 L 16 48 Z' } },
                { id: '', type: 'path', attr: { d: 'M 16 0 L 16 48 M 64 0 L 64 48 M 32 32 L 48 16 M 32 16 L 48 32 M 34.4 13.6 L 29.6 18.4 M 29.6 29.6 L 34.4 34.4 M 50.4 29.6 L 45.6 34.4 M 45.6 13.6 L 50.4 18.4' } }]
        },
        {
            name: 'crusher4', ico: 'assets/lib/svgeditor/shapes/img/crusher4.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0.5 0 L 80.5 0 L 64.5 48 L 16.5 48 Z' } },
                { id: '', type: 'path', attr: { d: 'M 16.5 0 L 16.5 48 M 64.5 0 L 64.5 48 M 24.5 8 L 34.9 18.4 M 56.5 8 L 46.1 18.4 M 34.9 29.6 L 24.5 40 M 46.1 29.6 L 56.5 40' } },
                { id: '', type: 'path', attr: { d: 'm 48.5,24 a 8,8 0 0 1 -8,8 8,8 0 0 1 -8,-8 8,8 0 0 1 8,-8 8,8 0 0 1 8,8' } }]
        },
        {
            name: 'crusher5', ico: 'assets/lib/svgeditor/shapes/img/crusher5.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 0 L 80 0 L 64 48 L 16 48 Z' } },
                { id: '', type: 'path', attr: { d: 'M 16 0 L 16 48 M 64 0 L 64 48' } },
                { id: '', type: 'path', attr: { d: 'm 56,24 a 8,8 0 0 1 -8,8 8,8 0 0 1 -8,-8 8,8 0 0 1 8,-8 8,8 0 0 1 8,8' } },
                { id: '', type: 'path', attr: { d: 'm 40,24 a 8,8 0 0 1 -8,8 8,8 0 0 1 -8,-8 8,8 0 0 1 8,-8 8,8 0 0 1 8,8' } }]
        },
        {
            name: 'crusher6', ico: 'assets/lib/svgeditor/shapes/img/crusher6.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 0 L 80 0 L 64 48 L 16 48 Z' } },
                { id: '', type: 'path', attr: { d: 'M 20 0 L 6.4 20 M 60 0 L 73.6 20' } }]
        },
        {
            name: 'crusher7', ico: 'assets/lib/svgeditor/shapes/img/crusher7.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0.5 0 L 80.5 0 L 64.5 48 L 16.5 48 Z' } },
                { id: '', type: 'path', attr: { d: 'M 20.5 0 L 6.9 20 M 60.5 0 L 74.1 20' } },
                { id: '', type: 'path', attr: { d: 'M 40.5 20 L 48.5 20 M 32.5 28 L 40.5 28' } },
                { id: '', type: 'path', attr: { d: 'm 56.5,24 a 16,16 0 0 1 -16,16 16,16 0 0 1 -16,-16 16,16 0 0 1 16,-16 16,16 0 0 1 16,16' } },
                { id: '', type: 'path', attr: { d: 'M 40.5 18 L 40.5 22 L 34.1 20 Z M 40.5 26 L 40.5 30 L 46.9 28 Z' } }]
        },
        {
            name: 'drier1', ico: 'assets/lib/svgeditor/shapes/img/drier1.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 6 0 L 54 0 L 60 15 L 60 84 L 0 84 L 0 15 Z' } }]
        },
        {
            name: 'drier2', ico: 'assets/lib/svgeditor/shapes/img/drier2.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 6 0 L 54 0 L 60 15 L 60 84 L 0 84 L 0 15 Z' } },
                { id: '', type: 'path', attr: { d: 'M 19.8 15.24 C 25.94 11.01 34.06 11.01 40.2 15.24' } },
                { id: '', type: 'path', attr: { d: 'M 42,30 A 12,12 0 0 1 30,42 12,12 0 0 1 18,30 12,12 0 0 1 30,18 12,12 0 0 1 42,30' } }]
        },
        {
            name: 'drier3', ico: 'assets/lib/svgeditor/shapes/img/drier3.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 6 0 L 54 0 L 60 15 L 60 84 L 0 84 L 0 15 Z' } },
                { id: '', type: 'path', attr: { d: 'M 0 24 L 60 24 M 0 42 L 60 42' } },
                { id: '', type: 'path', attr: { d: 'M 15.3,30 A 0.30000001,0.30000001 0 0 1 15,30.3 0.30000001,0.30000001 0 0 1 14.7,30 0.30000001,0.30000001 0 0 1 15,29.7 0.30000001,0.30000001 0 0 1 15.3,30' } },
                { id: '', type: 'path', attr: { d: 'M 7.8,36 A 0.30000001,0.30000001 0 0 1 7.5,36.3 0.30000001,0.30000001 0 0 1 7.2,36 0.30000001,0.30000001 0 0 1 7.5,35.7 0.30000001,0.30000001 0 0 1 7.8,36' } },
                { id: '', type: 'path', attr: { d: 'M 22.8,36 A 0.30000001,0.30000001 0 0 1 22.5,36.3 0.30000001,0.30000001 0 0 1 22.2,36 0.30000001,0.30000001 0 0 1 22.5,35.7 0.30000001,0.30000001 0 0 1 22.8,36' } },
                { id: '', type: 'path', attr: { d: 'M 30.3,30 A 0.30000001,0.30000001 0 0 1 30,30.3 0.30000001,0.30000001 0 0 1 29.7,30 0.30000001,0.30000001 0 0 1 30,29.7 0.30000001,0.30000001 0 0 1 30.3,30' } },
                { id: '', type: 'path', attr: { d: 'M 37.8,36 A 0.30000001,0.30000001 0 0 1 37.5,36.3 0.30000001,0.30000001 0 0 1 37.2,36 0.30000001,0.30000001 0 0 1 37.5,35.7 0.30000001,0.30000001 0 0 1 37.8,36' } },
                { id: '', type: 'path', attr: { d: 'M 45.3,30 A 0.30000001,0.30000001 0 0 1 45,30.3 0.30000001,0.30000001 0 0 1 44.7,30 0.30000001,0.30000001 0 0 1 45,29.7 0.30000001,0.30000001 0 0 1 45.3,30' } },
                { id: '', type: 'path', attr: { d: 'M 52.8,36 A 0.30000001,0.30000001 0 0 1 52.5,36.3 0.30000001,0.30000001 0 0 1 52.2,36 0.30000001,0.30000001 0 0 1 52.5,35.7 0.30000001,0.30000001 0 0 1 52.8,36' } }]
        },
        {
            name: 'drier4', ico: 'assets/lib/svgeditor/shapes/img/drier4.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 6 0 L 54 0 L 60 15 L 60 84 L 0 84 L 0 15 Z' } },
                { id: '', type: 'path', attr: { d: 'm 54,27 a 6,6 0 0 1 -6,6 6,6 0 0 1 -6,-6 6,6 0 0 1 6,-6 6,6 0 0 1 6,6' } },
                { id: '', type: 'path', attr: { d: 'm 18,27 a 6,6 0 0 1 -6,6 6,6 0 0 1 -6,-6 6,6 0 0 1 6,-6 6,6 0 0 1 6,6' } },
                { id: '', type: 'path', attr: { d: 'M 12 21 L 48 21 M 12 33 L 48 33' } }]
        },
        {
            name: 'drier5', ico: 'assets/lib/svgeditor/shapes/img/drier5.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 6 0 L 54 0 L 60 15 L 60 84 L 0 84 L 0 15 Z' } },
                { id: '', type: 'path', attr: { d: 'M 30 0 L 30 42 M 15 42 L 45 42 M 15 24 L 45 24 M 39 33 L 60 33 M 21 33 L 0 33' } }]
        },
        {
            name: 'nozzle', ico: 'assets/lib/svgeditor/shapes/img/nozzle.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 40 L 40 0 L 80 40 M 40 0 L 40 40' } }]
        },
        {
            name: 'nozzle2', ico: 'assets/lib/svgeditor/shapes/img/nozzle2.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 0 L 35 0 L 35 10 M 10 20 L 35 10 L 60 20 M 25 20 L 35 10 L 45 20' } }]
        },        
        {
            name: 'feeder', ico: 'assets/lib/svgeditor/shapes/img/feeder.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 30 L 60 30 M 45.48 4.2 L 14.52 55.8 M 14.52 4.2 L 45.48 55.8' } },
                { id: '', type: 'path', attr: { d: 'M 0 30 L 60 30 M 45.48 4.2 L 14.52 55.8 M 14.52 4.2 L 45.48 55.8' } },
                { id: '', type: 'path', attr: { d: 'm 33,30 a 3,3 0 0 1 -3,3 3,3 0 0 1 -3,-3 3,3 0 0 1 3,-3 3,3 0 0 1 3,3' } }]
        },
        {
            name: 'feeder2', ico: 'assets/lib/svgeditor/shapes/img/feeder2.svg', content: [
                { id: '', type: 'path', attr: { d: 'm 60.5,30 a 30,30 0 0 1 -30,30 30,30 0 0 1 -30,-30 30,30 0 0 1 30,-30 30,30 0 0 1 30,30' } },
                { id: '', type: 'path', attr: { d: 'M 6.5 12 L 54.5 12 L 6.5 48 L 54.5 48' } }]
        },
        {
            name: 'feeder3', ico: 'assets/lib/svgeditor/shapes/img/feeder3.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 80 0 C 80 22.09 62.09 40 40 40 C 17.91 40 0 22.09 0 0 L 300 0 C 300 22.09 282.09 40 260 40 C 237.91 40 220 22.09 220 0 Z M 150 1 L 180 50 L 120 50 Z' } }]
        },     
        {
            name: 'exchheat', ico: 'assets/lib/svgeditor/shapes/img/exchanger-heat.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 70,0 0,40 M 0,0 H 70 V 40 H 0 Z' } }]
        },
        {
            name: 'filter2', ico: 'assets/lib/svgeditor/shapes/img/filter2.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0,0 H 50 V 100 H 0 Z' } },
                { id: '', type: 'path', attr: { d: 'M 0 20 L 50 20 M 0 70 L 25 99.5 L 50 70' } }]
        },
        {
            name: 'filter3', ico: 'assets/lib/svgeditor/shapes/img/filter3.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0,0 H 100 V 50 H 0 Z' } },
                { id: '', type: 'path', attr: { d: 'M 10 10 L 10 40 M 30 10 L 30 40 M 50 10 L 50 40 M 70 10 L 70 40 M 90 10 L 90 40' } },
                { id: '', type: 'path', attr: { d: 'M 20 0 L 20 50 M 40 0 L 40 50 M 60 0 L 60 50 M 80 0 L 80 50' } }]
        },
        {
            name: 'fitting1', ico: 'assets/lib/svgeditor/shapes/img/fitting1.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 50.497713,25.25 A 25.247713,25.247713 0 0 1 25.25,50.497713 25.247713,25.247713 0 0 1 0.00228691,25.25 25.247713,25.247713 0 0 1 25.25,0.00228691 25.247713,25.247713 0 0 1 50.497713,25.25' } },
                { id: '', type: 'path', attr: { d: 'M 43.12 7.37 C 53 17.24 53 33.25 43.12 43.12 C 33.25 53 17.24 53 7.37 43.12 Z', fill: '#000000' } }]
        },
        {
            name: 'fitting2', ico: 'assets/lib/svgeditor/shapes/img/fitting2.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0.25 25.29 L 43.11 0.3 L 43.11 71.7 L 0.25 46.71 Z M 50.25 36 L 43.11 36' } }]
        },
        {
            name: 'fitting3', ico: 'assets/lib/svgeditor/shapes/img/fitting3.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0,0.30000001 H 40 V 80.3 H 0 Z' } },
                { id: '', type: 'path', attr: { d: 'M 0,0.30000001 H 40 V 80.3 H 0 Z' } },
                { id: '', type: 'path', attr: { d: 'M 20 0.3 L 20 80.3 M 0 20.3 L 40 20.3 M 0 40.3 L 40 40.3 M 0 60.3 L 40 60.3' } }]
        },
        {
            name: 'fitting4', ico: 'assets/lib/svgeditor/shapes/img/fitting4.svg', content: [
                { id: '', type: 'path', attr: { d: 'm 0,0.5 h 40 v 40 H 0 Z' } },
                { id: '', type: 'path', attr: { d: 'M 40 10.5 L 80 0.5 L 80 40.5 L 40 30.5 Z' } }]
        },        
        {
            name: 'fitting5', ico: 'assets/lib/svgeditor/shapes/img/fitting5.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0,0.30000001 H 50 V 100.3 H 0 Z' } },
                { id: '', type: 'path', attr: { d: 'M 10 0.3 L 10 20.3 C 26.57 20.3 40 33.73 40 50.3 C 40 66.87 26.57 80.3 10 80.3 L 10 100.3' } }]
        },
        {
            name: 'fitting6', ico: 'assets/lib/svgeditor/shapes/img/fitting6.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0,0 H 80 V 57.200001 H 0 Z' } },
                { id: '', type: 'path', attr: { d: 'M 20 28.6 L 20 57.2 M 40 0 L 40 28.6 M 60 28.6 L 60 57.2' } }]
        },
        {
            name: 'fitting7', ico: 'assets/lib/svgeditor/shapes/img/fitting7.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0.19 -0.4 C 16.06 6.88 34.32 6.88 50.19 -0.4 L 50.19 39.6 C 34.32 32.32 16.06 32.32 0.19 39.6 Z' } }]
        },
        {
            name: 'fitting8', ico: 'assets/lib/svgeditor/shapes/img/fitting8.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 -0.4 L 0 49.6 L 50 49.6 L 50 -0.4 L 25 14.6 Z' } }]
        },
        {
            name: 'fitting9', ico: 'assets/lib/svgeditor/shapes/img/fitting9.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 -0.2 C 6.79 4.13 27.32 7.01 50 6.8 L 50 17.8 C 27.32 17.59 6.79 20.47 0 24.8 Z' } }]
        },
        {
            name: 'fitting10', ico: 'assets/lib/svgeditor/shapes/img/fitting10.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 37 4.5 L 0.5 25.5 L 37 46.5' } },
                { id: '', type: 'path', attr: { d: 'm 75.5,25.5 a 25,25 0 0 1 -25,25 25,25 0 0 1 -25,-25 25,25 0 0 1 25,-25 25,25 0 0 1 25,25' } }]
        },
        {
            name: 'fitting11', ico: 'assets/lib/svgeditor/shapes/img/fitting11.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0,0 H 50 V 30 H 0 Z' } },
                { id: '', type: 'path', attr: { d: 'M 25,15 A 12.5,12.5 0 0 1 12.5,27.5 12.5,12.5 0 0 1 0,15 12.5,12.5 0 0 1 12.5,2.5 12.5,12.5 0 0 1 25,15' } },
                { id: '', type: 'path', attr: { d: 'M 50,15 A 12.5,12.5 0 0 1 37.5,27.5 12.5,12.5 0 0 1 25,15 12.5,12.5 0 0 1 37.5,2.5 12.5,12.5 0 0 1 50,15' } }]
        },
        {
            name: 'fitting12', ico: 'assets/lib/svgeditor/shapes/img/fitting12.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0,-0.40000001 H 50 V 49.6 H 0 Z' } },
                { id: '', type: 'path', attr: { d: 'M 0 49.6 L 25 39.6 L 50 49.6 M 0 19.6 L 25 29.6 L 50 19.6 M 25 29.6 L 25 -0.4' } }]
        },
        {
            name: 'fitting13', ico: 'assets/lib/svgeditor/shapes/img/fitting13.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0.5 15 C 0.5 6.72 7.22 0 15.5 0 C 23.78 0 30.5 6.72 30.5 15 C 30.5 23.28 37.22 30 45.5 30 C 53.78 30 60.5 23.28 60.5 15 C 60.5 6.72 67.22 0 75.5 0 C 83.78 0 90.5 6.72 90.5 15 C 90.5 23.28 97.22 30 105.5 30 C 113.78 30 120.5 23.28 120.5 15 C 120.5 6.72 127.22 0 135.5 0 C 143.78 0 150.5 6.72 150.5 15 C 150.5 23.28 157.22 30 165.5 30 C 173.78 30 180.5 23.28 180.5 15' } }]
        },
        {
            name: 'misc1', ico: 'assets/lib/svgeditor/shapes/img/misc1.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0,60 H 80 V 80 H 0 Z' } },
                { id: '', type: 'path', attr: { d: 'M 8 60 L 40 0 L 72 60 Z' } },
                { id: '', type: 'path', attr: { d: 'M 20 60 L 40 24 L 60 60' } }]
        },
        {
            name: 'misc2', ico: 'assets/lib/svgeditor/shapes/img/misc2.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 60 0 L 60 45 C 60 61.57 46.57 75 30 75 C 13.43 75 0 61.57 0 45 L 0 0 Z' } },
                { id: '', type: 'path', attr: { d: 'M 32.32 45.48 C 32.3 51.69 31.29 56.72 30.05 56.72 C 29.45 56.73 28.88 55.54 28.46 53.43 C 28.04 51.32 27.81 48.46 27.82 45.47 C 27.82 42.48 28.07 39.62 28.5 37.51 C 28.92 35.4 29.5 34.22 30.1 34.22 C 31.34 34.24 32.33 39.27 32.32 45.48 Z M 40.2 28.45 C 35.47 32.48 30.98 34.98 30.17 34.04 C 29.37 33.09 32.55 29.06 37.28 25.04 C 42.01 21.01 46.5 18.51 47.31 19.45 C 48.11 20.4 44.93 24.43 40.2 28.45 Z M 22.82 24.99 C 27.55 28.99 30.74 33.01 29.95 33.97 C 29.57 34.43 28.3 34.1 26.41 33.06 C 24.53 32.02 22.19 30.35 19.91 28.42 C 17.63 26.5 15.6 24.47 14.26 22.78 C 12.92 21.1 12.39 19.9 12.77 19.44 C 13.58 18.5 18.08 20.98 22.82 24.99 Z' } }]
        },
        {
            name: 'misc3', ico: 'assets/lib/svgeditor/shapes/img/misc3.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 10 100 L 20 0 L 40 0 L 50 100 Z M 0 100 L 60 100' } }]
        },
        {
            name: 'misc4', ico: 'assets/lib/svgeditor/shapes/img/misc4.svg', content: [
                { id: '', type: 'path', attr: { d: 'm 0,0.5 h 70 v 20 H 0 Z' } },
                { id: '', type: 'path', attr: { d: 'M 10 14.5 L 60 6.5 C 62.21 6.5 64 8.29 64 10.5 C 64 12.71 62.21 14.5 60 14.5 L 10 6.5 C 7.79 6.5 6 8.29 6 10.5 C 6 12.71 7.79 14.5 10 14.5 Z' } }]
        },        
        {
            name: 'misc5', ico: 'assets/lib/svgeditor/shapes/img/misc5.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 15 100.5 L 0 85.5 L 0 0.5 L 80 0.5 L 80 85.5 L 65 100.5 Z' } },
                { id: '', type: 'path', attr: { d: 'M 10 0.5 L 10 80.5 L 20 90.5 L 60 90.5 L 70 80.5 L 70 0.5' } }]
        },
        {
            name: 'misc6', ico: 'assets/lib/svgeditor/shapes/img/misc6.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 100.5 L 0 83.83 L 22.5 0.5 L 67.5 0.5 L 90 83.83 L 90 100.5 Z M 90 83.83 L 0 83.83' } }]
        },             
        {
            name: 'misc7', ico: 'assets/lib/svgeditor/shapes/img/misc7.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 60 L 0 0 L 7.5 0 L 7.5 52 L 56.25 52 L 56.25 0 L 63.75 0 L 63.75 52 L 112.5 52 L 112.5 0 L 120 0 L 120 60 Z M 0 4 L 3.75 0 M 0 12 L 7.5 4 M 0 20 L 7.5 12 M 0 28 L 7.5 20 M 0 36 L 7.5 28 M 0 44 L 7.5 36 M 30 60 L 37.5 52 M 0 52 L 7.5 44 M 0 60 L 7.5 52 M 7.5 60 L 15 52 M 15 60 L 22.5 52 M 22.5 60 L 30 52 M 37.5 60 L 45 52 M 45 60 L 52.5 52 M 52.5 60 L 63.75 48 M 60 60 L 67.5 52 M 67.5 60 L 75 52 M 82.5 60 L 90 52 M 90 60 L 97.5 52 M 97.5 60 L 105 52 M 105 60 L 120 44 M 112.5 60 L 120 52 M 112.5 44 L 120 36 M 112.5 36 L 120 28 M 112.5 28 L 120 20 M 112.5 20 L 120 12 M 112.5 12 L 120 4 M 112.5 4 L 116.25 0 M 75 60 L 82.5 52 M 56.25 48 L 63.75 40 M 56.25 40 L 63.75 32 M 56.25 32 L 63.75 24 M 56.25 24 L 63.75 16 M 56.25 16 L 63.75 8 M 56.25 8 L 63.75 0' } }]
        },          
        {
            name: 'misc8', ico: 'assets/lib/svgeditor/shapes/img/misc8.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0.19 0 L 7.69 0 L 7.69 52 L 112.69 52 L 112.69 0 L 120.19 0 L 120.19 60 L 0.19 60 Z M 0.19 4 L 3.94 0 M 0.19 12 L 7.69 4 M 0.19 20 L 7.69 12 M 0.19 28 L 7.69 20 M 0.19 36 L 7.69 28 M 0.19 44 L 7.69 36 M 30.19 60 L 37.69 52 M 0.19 52 L 7.69 44 M 0.19 60 L 7.69 52 M 7.69 60 L 15.19 52 M 15.19 60 L 22.69 52 M 22.69 60 L 30.19 52 M 37.69 60 L 45.19 52 M 45.19 60 L 52.69 52 M 52.69 60 L 60.19 52 M 60.19 60 L 67.69 52 M 67.69 60 L 75.19 52 M 82.69 60 L 90.19 52 M 90.19 60 L 97.69 52 M 97.69 60 L 105.19 52 M 105.19 60 L 120.19 44 M 112.69 60 L 120.19 52 M 112.69 44 L 120.19 36 M 112.69 36 L 120.19 28 M 112.69 28 L 120.19 20 M 112.69 20 L 120.19 12 M 112.69 12 L 120.19 4 M 112.69 4 L 116.44 0 M 75.19 60 L 82.69 52' } }]
        },    
        {
            name: 'tank1', ico: 'assets/lib/svgeditor/shapes/img/tank1.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0.5 0.25 L 80.5 0.25 L 90.5 20.25 L 100.5 20.25 L 100.5 40.25 L 90.5 40.25 L 80.5 60.25 L 0.5 60.25 Z' } }]
        },    
        {
            name: 'tank2', ico: 'assets/lib/svgeditor/shapes/img/tank2.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 87.34 14.93 C 91.57 14.93 95.01 23.88 95.01 34.93 C 95.02 45.97 91.59 54.93 87.36 54.93 L 7.68 54.97 C 3.45 54.97 0.01 46.02 0.01 34.97 C 0 23.93 3.43 14.97 7.66 14.97 L 52.48 14.94 L 52.47 4.94 C 52.47 2.18 56.93 -0.06 62.43 -0.07 C 67.93 -0.07 72.39 2.17 72.39 4.93 L 72.4 14.93 Z' } }]
        },    
        {
            name: 'tank3', ico: 'assets/lib/svgeditor/shapes/img/tank3.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 9.75 15.42 C 9.75 7.18 16.47 0.5 24.75 0.5 C 33.03 0.5 39.75 7.18 39.75 15.42 L 39.75 40.29 L 49.75 50.24 L 49.75 85.06 C 49.75 91.93 38.56 97.5 24.75 97.5 C 10.94 97.5 -0.25 91.93 -0.25 85.06 L -0.25 50.49 L 9.75 40.29 Z' } }]
        },   
        {
            name: 'tank4', ico: 'assets/lib/svgeditor/shapes/img/tank4.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 15 C 0 6.72 11.19 0 25 0 C 38.81 0 50 6.72 50 15 L 50 105 C 50 113.28 38.81 120 25 120 C 11.19 120 0 113.28 0 105 Z' } }]
        },   
        {
            name: 'tank5', ico: 'assets/lib/svgeditor/shapes/img/tank5.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 40 8.16 L 40 87.84 C 40 92.07 31.05 95.5 20 95.5 C 8.95 95.5 0 92.07 0 87.84 L 0 8.16 C 0 3.93 8.95 0.5 20 0.5 C 31.05 0.5 40 3.93 40 8.16 Z M 0 8.16 L 40 8.16 M 0 87.84 L 40 87.84' } }]
        },   
        {
            name: 'tank6', ico: 'assets/lib/svgeditor/shapes/img/tank6.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0,25.34 H 100 V 95.000004 H 0 Z' } },
                { id: '', type: 'path', attr: { d: 'M 0 25.34 C 28.47 0 71.53 0 100 25.34 Z' } }]
        },   
        {
            name: 'tank7', ico: 'assets/lib/svgeditor/shapes/img/tank7.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 20 L 0 90 L 100 90 L 100 20 L 50 0 Z M 0 20 L 100 20' } }]
        },   
        {
            name: 'tank8', ico: 'assets/lib/svgeditor/shapes/img/tank8.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 53 23 L 61.5 23 M 61.5 13 L 61.5 33 M 65.5 13 L 65.5 33 M 13 83 L 4.5 83 M 4.5 73 L 4.5 93 M 0 73 L 0 93 M 53 13 L 53 93 C 53 97.25 44.05 100.69 33 100.69 C 21.95 100.69 13 97.25 13 93 L 13 13 C 13 8.75 21.95 5.31 33 5.31 C 44.05 5.31 53 8.75 53 13 Z' } }]
        },   
        {
            name: 'tank9', ico: 'assets/lib/svgeditor/shapes/img/tank9.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 147.39 12.95 C 151.6 12.95 155 21.86 155 32.86 C 155 43.86 151.6 52.77 147.39 52.77 L 18.8 52.77 C 14.59 52.77 11.19 43.86 11.19 32.86 C 11.19 21.86 14.59 12.95 18.8 12.95 Z' } },
                { id: '', type: 'path', attr: { d: 'M 147.39 72.69 C 151.6 72.69 155 81.6 155 92.6 C 155 103.6 151.6 112.51 147.39 112.51 L 18.8 112.51 C 14.59 112.51 11.19 103.6 11.19 92.6 C 11.19 81.6 14.59 72.69 18.8 72.69 Z' } },
                { id: '', type: 'path', attr: { d: 'M 3.96 79.66 L 12.86 79.66 M 3.96 105.54 L 12.86 105.54 M 3.96 69.7 L 3.96 89.61 M 0 69.7 L 0 89.61 M 3.96 95.59 L 3.96 115.5 M 0 95.59 L 0 115.5 M 137.5 12.95 L 137.5 4.48 M 127.61 4.48 L 147.39 4.48 M 127.61 0.5 L 147.39 0.5 M 28.69 12.95 L 28.69 4.48 M 18.8 4.48 L 38.58 4.48 M 18.8 0.5 L 38.58 0.5' } },
                { id: '', type: 'path', attr: { d: 'm 33.630001,52.77 h 9.89 v 19.91 h -9.89 z' } },
                { id: '', type: 'path', attr: { d: 'm 117.72,52.77 h 9.89 v 19.91 h -9.89 z' } }]
        },   
        {
            name: 'exchanger1', ico: 'assets/lib/svgeditor/shapes/img/exchanger1.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0,0 H 100 V 30 H 0 Z' } },
                { id: '', type: 'path', attr: { d: 'M 15 0 L 15 30 M 85 0 L 85 30 M 85 7.5 L 15 7.5 M 85 15 L 15 15 M 85 22.5 L 15 22.5' } }]
        },   
        {
            name: 'exchanger2', ico: 'assets/lib/svgeditor/shapes/img/exchanger2.svg', content: [
                { id: '', type: 'path', attr: { d: 'm 0,0.5 h 100 v 30 H 0 Z' } },
                { id: '', type: 'path', attr: { d: 'M 15 0.5 L 15 30.5 M 85 0.5 L 85 30.5 M 26 10.5 L 26 20.5 M 42 10.5 L 42 20.5 M 58 10.5 L 58 20.5 M 74 10.5 L 74 20.5 M 66 10.5 L 66 20.5 M 50 10.5 L 50 20.5 M 34 10.5 L 34 20.5 M 15.12 15.5 L 85 15.5' } }]
        },
        {
            name: 'exchanger3', ico: 'assets/lib/svgeditor/shapes/img/exchanger3.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 30.5 L 15 30.5 L 15 24.5 L 75 24.5 L 75 30.5 L 90 30.5 L 90 0.5 L 75 0.5 L 75 6.5 L 15 6.5 L 15 0.5 L 0 0.5 Z M 15 6.5 L 15 24.5 M 75 6.5 L 75 24.5' } }]
        },  
        {
            name: 'exchanger4', ico: 'assets/lib/svgeditor/shapes/img/exchanger4.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 14.88 24.5 L 14.88 30.5 L 0 30.5 L 0 0.5 L 14.88 0.5 L 14.88 6.5 L 84.31 6.5 C 88 6.5 91 10.53 91 15.5 C 91 20.47 88 24.5 84.31 24.5 L 14.88 24.5 Z M 14.88 6.5 L 14.88 24.5 M 0 15.5 L 14.88 15.5' } }]
        },          
        {
            name: 'exchanger5', ico: 'assets/lib/svgeditor/shapes/img/exchanger5.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 4.48 15 L 16.41 15 L 16.41 30 L 4.48 30 C 2 30 0 26.64 0 22.5 C 0 18.36 2 15 4.48 15 M 19.39 15 L 26.36 15 L 41.27 0 L 86.03 0 C 88.77 0 91 6.72 91 15 C 91 23.28 88.77 30 86.03 30 L 19.39 30 Z M 4.48 15 L 4.48 30 M 41.27 0 L 41.27 30 M 86.03 0 L 86.03 30' } },
                { id: '', type: 'path', attr: { d: 'm 16.41,12 h 2.98 v 21 h -2.98 z' } }]
        },  
        {
            name: 'exchanger6', ico: 'assets/lib/svgeditor/shapes/img/exchanger6.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 10 L 80 10 L 80 80 L 40 120 L 0 80 Z' } },
                { id: '', type: 'path', attr: { d: 'M 25 30 L 25 95 M 55 30 L 55 95 M 25 40 L 55 40 M 25 85 L 55 85 M 40 0 L 40 40 M 0 30 L 15 30 L 15 95 M 80 30 L 65 30 L 65 95' } }]
        },  
        {
            name: 'exchanger7', ico: 'assets/lib/svgeditor/shapes/img/exchanger7.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 3 10.5 L 20 10.5 C 20 4.98 24.48 0.5 30 0.5 L 70 0.5 C 75.52 0.5 80 4.98 80 10.5 L 97 10.5 L 97 20.5 L 80 20.5 C 80 26.02 75.52 30.5 70 30.5 L 30 30.5 C 24.48 30.5 20 26.02 20 20.5 L 3 20.5 Z' } },
                { id: '', type: 'path', attr: { d: 'M 0 5.5 L 0 25.5 M 3 5.5 L 3 25.5 M 100 5.5 L 100 25.5 M 97 5.5 L 97 25.5' } }]
        },  
        {
            name: 'exchanger8', ico: 'assets/lib/svgeditor/shapes/img/exchanger8.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 20 0 L 80 0 L 88.5 20 L 80 40 L 20 40 L 11.5 20 Z' } },
                { id: '', type: 'path', attr: { d: 'M 0 10 L 0 30 M 3 10 L 3 30 M 3 20 L 11.5 20 M 100 10 L 100 30 M 97 10 L 97 30 M 97 20 L 88.5 20 M 20 0 L 20 40 M 30 0 L 30 40 M 40 0 L 40 40 M 50 0 L 50 40 M 60 0 L 60 40 M 70 0 L 70 40 M 80 0 L 80 40' } }]
        },  
        {
            name: 'exchanger9', ico: 'assets/lib/svgeditor/shapes/img/exchanger9.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0,0 H 100 V 40 H 0 Z' } },
                { id: '', type: 'path', attr: { d: 'M 8 0 L 8 40 M 92 0 L 92 40 M 8 5 L 92 5 M 8 10 L 92 10 M 8 15 L 92 15 M 8 20 L 92 20 M 8 25 L 92 25 M 8 30 L 92 30 M 8 35 L 92 35' } }]
        },  
        {
            name: 'exchfilter', ico: 'assets/lib/svgeditor/shapes/img/exchanger-filter.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0,0 70,70 M 14,0 70,56 M 28,0 70,42 M 42,0 70,28 M 56,0 70,14 M 0,14 56,70 M 0,28 42,70 M 0,42 28,70 M 0,56 14,70 M 0,14 14,0 M 0,28 28,0 M 0,42 42,0 M 0,56 56,0 M 0,70 70,0 M 70,14 14,70 M 28,70 70,28 M 70,42 42,70 M 56,70 70,56 M 0,0 H 70 V 70 H 0 Z' } }]
        },
        {
            name: 'pipi1', ico: 'assets/lib/svgeditor/shapes/img/pipi1.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 35,10.29 A 10,10.294118 0 0 1 25,20.584118 10,10.294118 0 0 1 15,10.29 10,10.294118 0 0 1 25,-0.00411797 10,10.294118 0 0 1 35,10.29' } },
                { id: '', type: 'path', attr: { d: 'M 0 10.29 L 50 10.29 M 50 0 L 50 20.59 M 0 0 L 0 20.59 M 40 35 L 50 26.25 M 45 30.88 L 32.2 17.5' } }]
        },  
        {
            name: 'pipi2', ico: 'assets/lib/svgeditor/shapes/img/pipi2.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 35,30 A 10,10 0 0 1 25,40 10,10 0 0 1 15,30 10,10 0 0 1 25,20 10,10 0 0 1 35,30' } },
                { id: '', type: 'path', attr: { d: 'M 35,10 A 10,10 0 0 1 25,20 10,10 0 0 1 15,10 10,10 0 0 1 25,0 10,10 0 0 1 35,10' } },
                { id: '', type: 'path', attr: { d: 'M 0 20 L 50 20 M 50 10 L 50 30 M 0 10 L 0 30' } }]
        }, 
        {
            name: 'pipi3', ico: 'assets/lib/svgeditor/shapes/img/pipi3.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 10.79 L 50 10.79 M 50 0.5 L 50 21.09 M 0 0.5 L 0 21.09 M 25 10.79 L 45 31.38 M 40 35.5 L 50 26.75' } }]
        }, 
        {
            name: 'pipi4', ico: 'assets/lib/svgeditor/shapes/img/pipi4.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 40 0 L 40 30 C 40 38.28 33.28 45 25 45 C 16.72 45 10 38.28 10 30 L 10 0 Z M 50 15 L 50 35 M 0 15 L 0 35 M 0 25 L 10 25 M 40 25 L 50 25' } }]
        }, 
        {
            name: 'pipi5', ico: 'assets/lib/svgeditor/shapes/img/pipi5.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 30,15 A 15,15 0 0 1 15,30 15,15 0 0 1 0,15 15,15 0 0 1 15,0 15,15 0 0 1 30,15' } },
                { id: '', type: 'path', attr: { d: 'M 24 3 L 0 15 L 24 27' } }]
        }, 
        {
            name: 'pipi6', ico: 'assets/lib/svgeditor/shapes/img/pipi6.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 6 L 7 6 C 7 3.51 9.01 1.5 11.5 1.5 C 13.99 1.5 16 3.51 16 6 C 16 3.51 18.01 1.5 20.5 1.5 C 22.99 1.5 25 3.51 25 6 C 25 3.51 27.01 1.5 29.5 1.5 C 31.99 1.5 34 3.51 34 6 C 34 3.51 36.01 1.5 38.5 1.5 C 40.99 1.5 43 3.51 43 6 L 50 6 L 50 14 L 43 14 C 43 16.49 40.99 18.5 38.5 18.5 C 36.01 18.5 34 16.49 34 14 C 34 16.49 31.99 18.5 29.5 18.5 C 27.01 18.5 25 16.49 25 14 C 25 16.49 22.99 18.5 20.5 18.5 C 18.01 18.5 16 16.49 16 14 C 16 16.49 13.99 18.5 11.5 18.5 C 9.01 18.5 7 16.49 7 14 L 0 14 Z Z M 50 0 L 50 20 M 0 0 L 0 20' } }]
        }, 
        {
            name: 'pipi7', ico: 'assets/lib/svgeditor/shapes/img/pipi7.svg', content: [
                { id: '', type: 'path', attr: { d: 'm 35,10.5 a 10,10 0 0 1 -10,10 10,10 0 0 1 -10,-10 10,10 0 0 1 10,-10 10,10 0 0 1 10,10' } },
                { id: '', type: 'path', attr: { d: 'M 0 10.5 L 15 10.5 M 35 10.5 L 50 10.5' } }]
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