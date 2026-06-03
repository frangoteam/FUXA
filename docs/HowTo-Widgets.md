**Fuxa Widgets**

Fuxa widgets use pure SVGs with Javascript by the use of script tags
```
<svg>
  SVG Content Here
  <script>
     JS Script Content Here
  </script>
</svg>
```
We can transfer data between the SVG script using some simple functions and declaring the variables as global
```
_pb_ = bool   parameter ( true or false )
_pn_ = number parameter ( Int, Float, Real etc )
_ps_ = string parameter ( string can be entered directly )
_pc_ = color parameter in hex color code ( #00ff00ff )
```
It's also very important that the variables are contained within these comments `//!export-start` and `//!export-end`
```
//!export-start
let _pn_value = 50;
//!export-end
```
The variables will now be available in Fuxa in the SVG properties panel where you can bind Fuxa Tags
 

In order to transfer data between the Widget/SVG we have 2x functions we need to use:

To send values to Fuxa from the SVG
```
function postValue(id, value) {
  console.error('Not defined!');
}
```
You need to call the function, the ID needs to match the exact variable name
```
postValue('_pn_value', someNewValue);
```

To receive values from Fuxa to the SVG
```
function putValue(id, value) {
  if (id === '_pn_value') {
    callFunction(value);
    newVar = value;
  }
}
```
Here we wait for the function to be called in Fuxa and check for the ID we are after which is the exact variable name defined

If you use `setInterval` you also need to clear the interval when you change page or enter the editor, if you do not do this the widget will become broken due to another `setInterval` being called. In our examples we check the object if it exist and use the MutationObserver

```
const checkDestroy = document.getElementById('svgIdName'); // Important must be name of the SVG!
if (!checkDestroy) {
  clearBlinking(); 
  return;
}
```
And the Mutation Observer 
```
// Set up the MutationObserver to watch for removal of the SVG element
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.removedNodes.forEach((node) => {
      if (node.id === 'svgIdName') { // Important must be name of the SVG!
        clearBlinking(); 
        observer.disconnect(); 
      }
    });
  });
});
// Start observing the body or a parent element of the SVG
observer.observe(document.body, { childList: true, subtree: true }); 
```

It's important you use the SVG Id `<svg id=svgIdName>` at the top of the SVG file

You can also use CSS in the SVG and full JS and access the elements/ids using standard `getElementById` and `addEventListener`

For full working examples, see the examples in the widget section https://github.com/frangoteam/FUXA/tree/master/server/_widgets 
 
