// add the shape library: with file name as parameter (have to be unique)
(function () {
    'use strict';
    var shapesGroupName = 'editor.animated';     // used to organize and gropping the shapes, displayed in editor menu as label with expand/collapse 
    var typeId = 'ape';              // used to identify shapes type, 'shapes' is binded with angular component 'ApeShapesComponent'
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
            name: 'eli', ico: 'assets/lib/svgeditor/shapes/img/anim-eli.svg', content: [
                { id: '', type: 'path', attr: { d: 'm32.8 0.344c-1.7 0-2.3 0.796-1.9 2.396l7 27.66a10 10 0 0 0-2.8 1.2l-4.9-8.5-8.5-14.36c-1-1.72-2.4-2.07-4.1-1.1l-4.3 2.46c-0.9 0.5-1.3 1.7-0.3 3.3l19.6 19.9a10 10 0 0 0-1.3 1.9l-8.5-4.9-14.7-8.5c-1.7-1-3.1-0.6-4.1 1.1l-2.5 4.3c-0.503 0.9-0.1 2.3 1.6 3.3l26.9 7.4a10 10 0 0 0-0.2 2.4h-27c-1.6 0-2.501 0.8-2.501 2.5v5c0 1.7 0.801 2.3 2.401 1.9l27.4-6.9a10 10 0 0 0 1.2 2.7l-8.5 4.9-15.4 9c-0.9 0.5-1.2 1.8-0.2 3.6l2.46 4.3c0.54 0.9 1.74 1.3 2.64 0.8l20.7-20.1a10 10 0 0 0 1.9 1.4l-4.8 8.2-9 15.6c-0.5 0.9-0.1 2.2 1.6 3.2l4.4 2.5c0.8 0.5 2.2 0.2 2.7-0.7l7.9-27.7a10 10 0 0 0 2.6 0.2v27.1c0 1.7 0.8 2.5 2.5 2.5h5c1.7 0 2.3-0.8 1.9-2.4l-6.9-27.6a10 10 0 0 0 2.4-1.1l4.9 8.5 9 15.6c0.6 0.9 2 1.2 2.8 0.8l4.4-2.6c1.7-0.9 2.1-2.4 0.6-2.7l-20-20.7a10 10 0 0 0 2.1-2.7l8.4 4.9 15.6 9c0.9 0.5 2.3 0.1 2.8-0.7l2.5-4.4c1-1.7 0.6-3.1-0.8-2.7l-27.7-7.9a10 10 0 0 0 0-0.1 10 10 0 0 0 0.2-0.6 10 10 0 0 0 0.3-2.6h27.5c1.7 0 2.5-0.8 2.5-2.5v-5c0-1.7-0.8-2.3-2.4-1.9l-27.9 7a10 10 0 0 0-0.3-0.9 10 10 0 0 0 0-0.1 10 10 0 0 0-0.2-0.5 10 10 0 0 0-0.3-0.6 10 10 0 0 0-0.2-0.5l8.4-4.8 15.3-9.2c1.5-0.8 1.7-2 1.2-2.9l-2.5-4.3c-1-1.7-2.2-2.2-3-0.6l-20.5 20.1a10 10 0 0 0-2.7-2.1l4.9-8.4 8.7-15.52c0.9-1.45 0.4-2.6-0.5-3.1l-4.3-2.5c-1.7-1.003-3-0.9-2.9 1l-7.7 27.62a10 10 0 0 0-3.1-0.5v-27.26c0-1.67-0.8-2.496-2.5-2.496z' } }]
        },
        {
            name: 'piston', ico: 'assets/lib/svgeditor/shapes/img/anim-piston.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 40.527149,0.87288138 V 53.042373', 'stroke-width': '5' } },
                { id: 'pm', type: 'rect', attr: { x: '2', y: '50', width: '76', height: '28'} }]
        }]; 


    
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