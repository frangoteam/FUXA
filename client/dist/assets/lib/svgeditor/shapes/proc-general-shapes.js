
(function () {
    'use strict';
    var shapesGroupName = 'Proc. Eng.'; 

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
            name: 'motor', ico: 'assets/lib/svgeditor/shapes/img/motor-simb.svg', content: [
                { id: 'c', type: 'ellipse', attr: { cx: '20', cy: '20', rx: '20.5', ry: '20.5' } },
                { id: 's', type: 'path', attr: { d: 'M 20,1 40,20.25 20,39.5 Z', fill: '#000000' } }]
        },
        {
            name: 'exchfilter', ico: 'assets/lib/svgeditor/shapes/img/exchanger-filter.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0,0 70,70 M 14,0 70,56 M 28,0 70,42 M 42,0 70,28 M 56,0 70,14 M 0,14 56,70 M 0,28 42,70 M 0,42 28,70 M 0,56 14,70 M 0,14 14,0 M 0,28 28,0 M 0,42 42,0 M 0,56 56,0 M 0,70 70,0 M 70,14 14,70 M 28,70 70,28 M 70,42 42,70 M 56,70 70,56 M 0,0 H 70 V 70 H 0 Z' } }]
        },
        {
            name: 'exchheat', ico: 'assets/lib/svgeditor/shapes/img/exchanger-heat.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 70,0 0,40 M 0,0 H 70 V 40 H 0 Z' } }]
        },
        {
            name: 'exchtube', ico: 'assets/lib/svgeditor/shapes/img/exchanger-tube.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 7.04,0 V 40 M 80.96,0 V 40 M 7.04,5 H 80.96 M 7.04,10 H 80.96 M 7.04,15 H 80.96 M 7.04,20 H 80.96 M 7.04,25 H 80.96 M 7.04,30 H 80.96 M 7.04,35 H 80.96 M 0,0 H 88 V 40 H 0 Z' } }]
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