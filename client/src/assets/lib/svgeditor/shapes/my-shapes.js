
// add the shape library: with file name as parameter (have to be unique)
(function () {
    'use strict';
    var shapesGroupName = 'Shapes';     // used to organize and gropping the shapes, displayed in editor menu as label with expand/collapse 
    var typeId = 'shapes';              // used to identify shapes type, 'shapes' is binded with angular component 'ShapesComponent'
    // if you make a new type you have to implement the angular component too 

    // add in this array your schapes data, the shape object has the following attributes:
    // 'name': is unique for shape type
    // 'ico': path icon displayed in editor menu
    // 'content': array of svg element 
    // 'id': element id used if you like make a animation managed in angular component
    // 'type': svg element type (path, text, ellipse,...) see svg description
    // 'attr': element attribute, depending of type
    var shapes = [
        {
            name: 'rectangle', ico: 'assets/lib/svgeditor/shapes/img/shape-rectangle.svg', content: [
                { id: '', type: 'rect', attr: { width: '40', height: '40' } }]
        },           
        {
            name: 'circle', ico: 'assets/lib/svgeditor/shapes/img/shape-circle.svg', content: [
                { id: '', type: 'ellipse', attr: { cx: '20', cy: '20', rx: '20.5', ry: '20.5' } }]
        },        
        {
            name: 'diamond', ico: 'assets/lib/svgeditor/shapes/img/shape-diamond.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 20 0 L 40 20 L 20 40 L 0 20 Z' } }]
        },
        {
            name: 'triangle', ico: 'assets/lib/svgeditor/shapes/img/shape-triangle.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 0 L 30 20 L 0 40 Z' } }]
        },
        {
            name: 'halfcircle', ico: 'assets/lib/svgeditor/shapes/img/shape-halfcircle.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 0 C 0 11.05 8.95 20 20 20 C 31.05 20 40 11.05 40 0 Z' } }]
        },
        {
            name: 'delay', ico: 'assets/lib/svgeditor/shapes/img/shape-delay.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 0 L 30 0 Q 40 0 40 10 Q 40 20 30 20 L 0 20 Z' } }]
        },
        {
            name: 'looplimit', ico: 'assets/lib/svgeditor/shapes/img/shape-looplimit.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 12 0 L 28 0 L 40 9.6 L 40 32 L 0 32 L 0 9.6 Z' } }]
        },
        {
            name: 'prepara', ico: 'assets/lib/svgeditor/shapes/img/shape-prepara.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 10 0 L 30 0 L 40 13.34 L 30 26.67 L 10 26.67 L 0 13.34 Z' } }]
        },
        {
            name: 'trape', ico: 'assets/lib/svgeditor/shapes/img/shape-trape.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 20 L 8 0 L 32 0 L 40 20 Z' } }]
        },
        {
            name: 'offpage', ico: 'assets/lib/svgeditor/shapes/img/shape-offpage.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 0 L 40 0 L 40 15 L 20 30 L 0 15 Z' } }]
        },
        {
            name: 'parallelogram', ico: 'assets/lib/svgeditor/shapes/img/shape-parallelogram.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 60 L 24 0 L 120 0 L 96 60 Z' } }]
        },
        {
            name: 'maninput', ico: 'assets/lib/svgeditor/shapes/img/shape-maninput.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 80 L 0 30 L 80 0 L 80 80 Z' } }]
        },        
        {
            name: 'pentagon', ico: 'assets/lib/svgeditor/shapes/img/shape-pentagon.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 17.16 80 L 0 29.33 L 45 0 L 90 29.33 L 72.84 80 Z' } }]
        }, 
        {
            name: 'octagon', ico: 'assets/lib/svgeditor/shapes/img/shape-octagon.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 30 0 L 70 0 L 100 30 L 100 70 L 70 100 L 30 100 L 0 70 L 0 30 Z' } }]
        },         
        {
            name: 'ticket', ico: 'assets/lib/svgeditor/shapes/img/shape-ticket.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 0 L 29 0 L 29 0 L 40 10 L 29 20 L 29 20 L 0 20 L 0 10 Z' } }]
        },        
        {
            name: 'display', ico: 'assets/lib/svgeditor/shapes/img/shape-display.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 20 L 22.5 0 L 70 0 Q 90 0 90 20 Q 90 40 70 40 L 22.5 40 Z' } }]
        },
        {
            name: 'or2', ico: 'assets/lib/svgeditor/shapes/img/shape-or2.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 80,40 A 40,40 0 0 1 40,80 40,40 0 0 1 0,40 40,40 0 0 1 40,0 40,40 0 0 1 80,40 M 0,40 H 80 M 40,0 V 80 Z' } }]
        },
        {
            name: 'vor', ico: 'assets/lib/svgeditor/shapes/img/shape-vor.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 80,40 A 40,40 0 0 1 40,80 40,40 0 0 1 0,40 40,40 0 0 1 40,0 40,40 0 0 1 80,40 M 0,40 H 80 Z' } }]
        },
        {
            name: 'tape', ico: 'assets/lib/svgeditor/shapes/img/shape-tape.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 20 Q 30 56 60 20 Q 90 -16 120 20 L 120 80 Q 90 44 60 80 Q 30 116 0 80 L 0 20 Z' } }]
        },
        {
            name: 'docu', ico: 'assets/lib/svgeditor/shapes/img/shape-docu.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 0 L 120 0 L 120 59 Q 90 21.2 60 59 Q 30 96.8 0 59 L 0 21 Z' } }]
        },        
        {
            name: 'cloud', ico: 'assets/lib/svgeditor/shapes/img/shape-cloud.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 20 17.5 C 4 17.5 0 35 12.8 38.5 C 0 46.2 14.4 63 24.8 56 C 32 70 56 70 64 56 C 80 56 80 42 70 35 C 80 21 64 7 50 14 C 40 3.5 24 3.5 20 17.5 Z' } }]
        },
        {
            name: 'or', ico: 'assets/lib/svgeditor/shapes/img/shape-or.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 0 Q 60 0 60 40 Q 60 80 0 80 Q 30 40 0 0 Z' } }]
        },
        {
            name: 'switch', ico: 'assets/lib/svgeditor/shapes/img/shape-switch.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 0 Q 40 40 80 0 Q 40 40 80 80 Q 40 40 0 80 Q 40 40 0 0 Z' } }]
        },
        {
            name: 'star4', ico: 'assets/lib/svgeditor/shapes/img/shape-star4.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 40 L 32 32 L 40 0 L 48 32 L 80 40 L 48 48 L 40 80 L 32 48 Z' } }]
        },     
        {
            name: 'poval', ico: 'assets/lib/svgeditor/shapes/img/shape-poval.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 25 0 C 0 22.78 0 57.22 25 80 C 49.99 57.22 49.99 22.78 25 0 Z' } }]
        },
        {
            name: 'drop', ico: 'assets/lib/svgeditor/shapes/img/shape-drop.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 25 0 L 47.27 43.64 C 49.06 47.16 50 51.05 50 55 C 50 61.63 47.37 67.99 42.68 72.68 C 37.99 77.37 31.63 80 25 80 C 18.37 80 12.01 77.37 7.32 72.68 C 2.63 67.99 0 61.63 0 55 C 0 51.05 0.94 47.16 2.73 43.64 Z' } }]
        },
        {
            name: 'heart', ico: 'assets/lib/svgeditor/shapes/img/shape-heart.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 40 80 C 42.96 76.66 59.91 57.56 70.51 45.62 C 80 34.93 79.79 19.35 71.17 9.68 C 62.54 0 48.58 0.04 40 9.76 C 31.41 0.04 17.46 0 8.83 9.67 C 0.2 19.34 0 34.93 9.49 45.62 C 20.08 57.56 37.03 76.66 40 80 Z' } }]
        },
        {
            name: 'nosymbol', ico: 'assets/lib/svgeditor/shapes/img/shape-nosymbol.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 40 C 0 17.91 17.91 0 40 0 C 62.09 0 80 17.91 80 40 C 80 62.09 62.09 80 40 80 C 17.91 80 0 62.09 0 40 Z M 63.16 55.76 C 70.77 44.64 69.38 29.68 59.85 20.15 C 50.32 10.62 35.36 9.23 24.24 16.84 Z M 16.92 24.24 C 9.34 35.35 10.72 50.27 20.22 59.79 C 29.71 69.32 44.63 70.75 55.76 63.2 Z' } }]
        },
        {
            name: 'cylinder', ico: 'assets/lib/svgeditor/shapes/img/shape-cylinder.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 16 C 0 -5.33 60 -5.33 60 16 L 60 64 C 60 85.33 0 85.33 0 64 Z' } },
                { id: '', type: 'path', attr: { d: 'M 0 16 C 0 32 60 32 60 16' } }]
        },
        {
            name: 'cone', ico: 'assets/lib/svgeditor/shapes/img/shape-cone.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 90.81 C 0 85.73 22.39 81.61 50 81.61 C 77.61 81.61 100 85.73 100 90.81 M 50 0 L 100 90.81 C 100 95.88 77.61 100 50 100 C 22.39 100 0 95.88 0 90.81 Z' } }]
        },
        {
            name: 'cross', ico: 'assets/lib/svgeditor/shapes/img/shape-cross.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 32 L 32 32 L 32 0 L 48 0 L 48 32 L 80 32 L 80 48 L 48 48 L 48 80 L 32 80 L 32 48 L 0 48 Z' } }]
        },
        {
            name: 'corner', ico: 'assets/lib/svgeditor/shapes/img/shape-corner.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 0 L 80 0 L 80 20 L 20 20 L 20 80 L 0 80 Z' } }]
        },
        {
            name: 'tee', ico: 'assets/lib/svgeditor/shapes/img/shape-tee.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 0 L 80 0 L 80 20 L 50 20 L 50 80 L 30 80 L 30 20 L 0 20 Z' } }]
        },        
        {
            name: 'arrow', ico: 'assets/lib/svgeditor/shapes/img/shape-arrow.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 8.04 L 31 8.04 L 31 0 L 40 12 L 31 24 L 31 15.96 L 0 15.96 L 0 12 Z' } }]
        },
        {
            name: 'doublearrow', ico: 'assets/lib/svgeditor/shapes/img/shape-doublearrow.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 10 9 L 30 9 L 30 0 L 40 12 L 30 24 L 30 15 L 10 15 L 10 24 L 0 12 L 10 0 Z' } }]
        },
        {
            name: 'rectindi', ico: 'assets/lib/svgeditor/shapes/img/shape-rectindi.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 11.3,39.7 V 23 M 0,0 H 23 V 23 H 0 Z' } }]
        },
        {
            name: 'circleindi', ico: 'assets/lib/svgeditor/shapes/img/shape-circleindi.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 12,40 V 24 M 24,12 A 12,12 0 0 1 12,24 12,12 0 0 1 0,12 12,12 0 0 1 12,0 12,12 0 0 1 24,12 Z' } }]
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