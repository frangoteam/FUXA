The shapes folder are located in: ‘client/dist/assets/lib/svgeditor/shapes’ (or ‘client/src/lib/svgeditor/shapes’ if you are debugging), you can add a new shape by creating a new javascript file (best copying it from ‘my-shapes.js’) or editing an existing file.

In the javascript file you can change the following content:
```
var shapesGroupName = 'Shapes'; // used to organize and gropping the shapes, displayed in editor menu as label with expand/collapse

var typeId = 'shapes';  // used to identify shapes type, 'shapes' is binded with angular component 'ShapesComponent'
                        // if you make a new type you have to implement the angular component too

```

in this array your shapes data, the shape object has the following attributes:
```
var shapes = [{ name: 'diamond', 
                ico: 'assets/lib/svgeditor/shapes/img/shape-diamond.svg', 
                content:[{ id: '', 
                            type: 'path', 
                            attr: { d: 'M 20 0 L 40 20 L 20 40 L 0 20 Z' }
                        }]
		},...]

// 'name': is unique for shape type
// 'ico': path icon displayed in editor menu
// 'content': array of svg element
// 'id': element id used if you like make an animation managed in angular component
// 'type': svg element type (path, text, ellipse,...) see svg description
// 'attr': element attribute, depending of type

```

To design my shapes I used the Inkscape application. You can see with XML Editor the elements and nodes attribute to add in 'type' and 'attr'.

**!You have to leave the rest of file content**

If you have created a new javascript shapes file, you have to add to loader too, 
then add to ‘shapesLoader.js’ your file name that will be loaded dynamically (don’t remove ‘shapesLoader.js’)
```
var shapesToLoad = ['my-shapes.js', 'your shape file name.js'];

```

If you have created a new shapes type, for example to define your own animations, you have to implement the correspondent angular component too. It is better to looking the files content in ‘client/src/app/gauges/shapes/’