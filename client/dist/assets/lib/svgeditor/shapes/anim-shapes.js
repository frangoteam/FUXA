// add the shape library: with file name as parameter (have to be unique)
(function () {
    'use strict';
    var shapesGroupName = 'Anim';     // used to organize and gropping the shapes, displayed in editor menu as label with expand/collapse 
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
            name: 'pipe', ico: 'assets/lib/svgeditor/shapes/img/valve-cx.svg', content: [
                { id: '', type: 'path', attr: { d: 'M 12 56.42 L 0 70 L 60 70 L 48 56.42' } },
                { id: '', type: 'path', attr: { d: 'M 0.6 26.12 C 3.03 11.11 15.43 0.09 30 0 L 70 0 L 70 20.9 L 58.45 20.9 C 62.26 32.07 59.71 44.54 51.86 53.11 C 44 61.67 32.19 64.87 21.34 61.37 C 10.49 57.87 2.46 48.27 0.6 36.57' } },
                { id: '', type: 'ellipse', attr: { cx: '30', cy: '32', rx: '25', ry: '25', 'stroke-width': '2.22' } },
                { id: 'c', type: 'path', attr: { d: 'M 30 9.78 C 35.66 16.1 35.66 25.67 30 32 C 24.34 38.33 24.34 47.9 30 54.22 M 45.72 16.28 C 45.25 24.76 38.48 31.53 30 32 C 21.52 32.47 14.75 39.24 14.28 47.72 M 52.22 32 C 45.9 37.66 36.33 37.66 30 32 C 23.67 26.34 14.1 26.34 7.78 32 M 45.72 47.72 C 37.24 47.25 30.47 40.48 30 32 C 29.58 23.43 22.73 16.59 14.17 16.17' } },
                { id: '', type: 'ellipse', attr: { cx: '30', cy: '32', rx: '1.6666666666666667', ry: '1.6666666666666667' } }
            ]
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