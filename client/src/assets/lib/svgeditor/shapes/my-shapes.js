
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
            name: 'ticket', ico: 'assets/lib/svgeditor/shapes/img/shape-ticket.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 0 0 L 29 0 L 29 0 L 40 10 L 29 20 L 29 20 L 0 20 L 0 10 Z' } }]
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