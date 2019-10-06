import { Component, Inject, OnInit, OnDestroy, AfterViewInit, ViewChild, ViewContainerRef, ComponentFactoryResolver, ElementRef } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { DomSanitizer } from '@angular/platform-browser';
import { MatIconRegistry } from '@angular/material';
import { Subscription } from 'rxjs/Subscription';
import { TranslateService } from '@ngx-translate/core';

import { ProjectService } from '../_services/project.service';
import { Hmi, View, GaugeSettings, SelElement } from '../_models/hmi';
import { WindowRef } from '../_helpers/windowref';
import { Output } from '@angular/core/src/metadata/directives';
import { GaugePropertyComponent, GaugeDialogType } from '../gauges/gauge-property/gauge-property.component';
import { LayoutPropertyComponent } from './layout-property/layout-property.component';

import { GaugesManager } from '../gauges/gauges.component';
import { GaugeBaseComponent } from '../gauges/gauge-base/gauge-base.component'
import { Utils } from '../_helpers/utils';
import { ConfirmDialogComponent } from '../gui-helpers/confirm-dialog/confirm-dialog.component';

import * as FileSaver from 'file-saver';
import { HtmlButtonComponent } from '../gauges/controls/html-button/html-button.component';
import { GaugeProgressComponent } from '../gauges/controls/gauge-progress/gauge-progress.component';
import { NgxDygraphsComponent } from '../gui-helpers/ngx-dygraphs/ngx-dygraphs.component';

declare var Gauge: any;

declare var $: any;
declare var svgEditor: any;
declare var mypathseg: any;         ///< svg-editor component
declare var initPathSeg: any;
declare var mybrowser: any;
declare var initBrowser: any;
declare var mysvgutils: any;
declare var initSvgutils: any;
declare var myselect: any;
declare var initSelect: any;
declare var mydraw: any;
declare var initDraw: any;
declare var mylocal: any;
declare var initLocale: any;
declare var mycontextmenu: any;
declare var initContextmenu: any;
declare var mysvgcanvas: any;
declare var initSvgCanvas: any;
declare var mysvgeditor: any;
declare var initSvgEditor: any;

@Component({
    moduleId: module.id,
    templateUrl: 'editor.component.html',
    styleUrls: ['editor.component.css']
})

export class EditorComponent implements OnInit, AfterViewInit, OnDestroy {
    // currentUser: User;
    // users: User[] = [];
    // @ViewChild('fillcolor') fillcolor: ElementRef;
    @ViewChild('gaugepanel') gaugePanelComponent: GaugeBaseComponent;

    defaultColor = Utils.defaultColor;
    colorFill: string = '#FFFFFF'
    colorStroke: string = '#000000'
    currentView: View = null;
    hmi: Hmi = new Hmi();// = {_id: '', name: '', networktype: '', ipaddress: '', maskaddress: '' };
    currentMode = '';
    imagefile: string;
    gridOn: boolean = false;
    selectedElement: SelElement = new SelElement();
    panelsState = {
        enabled: false,
        panelA: true,
        panelB: true,
        panelC: true,
        panelD: true,
        panelS: true
    };
    panelPropertyIdOpenState: boolean;
    panelPropertyTransformOpenState: boolean;
    panelAlignOpenState: boolean;
    panelFillOpenState: boolean;
    panelEventOpenState: boolean;
    panelMarkerOpenState: boolean;

    private gaugesRef = [];

    private subscriptionSave: Subscription;
    private subscriptionLoad: Subscription;

    constructor(private projectService: ProjectService,
        private winRef: WindowRef,
        public dialog: MatDialog,
        private translateService: TranslateService,
        private gaugesManager: GaugesManager,
        private viewContainerRef: ViewContainerRef,
        private resolver: ComponentFactoryResolver,
        private mdIconRegistry: MatIconRegistry, private sanitizer: DomSanitizer) {
        mdIconRegistry.addSvgIcon('group', sanitizer.bypassSecurityTrustResourceUrl('/assets/images/group.svg'));
        mdIconRegistry.addSvgIcon('to_bottom', sanitizer.bypassSecurityTrustResourceUrl('/assets/images/to-bottom.svg'));
        mdIconRegistry.addSvgIcon('to_top', sanitizer.bypassSecurityTrustResourceUrl('/assets/images/to-top.svg'));

        // this.gaugesManager.stopDemo();
    }

    //#region Implemented onInit / onAfterInit event
    /**
     * init event
     */
    ngOnInit() {
        try {
            this.subscriptionSave = this.projectService.onSaveCurrent.subscribe(saveas => {
                this.onSaveProject();
                if (saveas) {
                    this.projectService.saveAs();
                }
            });
            this.subscriptionLoad = this.projectService.onLoadHmi.subscribe(load => {
                this.loadHmi();
            });
        }
        catch (e) {
            console.log(e);
        }
    }

    /**
     * after init event
     */
    ngAfterViewInit() {
        setTimeout(() => {
            this.myInit();
            this.setMode('select');
            this.loadHmi();
            this.loadPanelState();
        }, 1000)
    }

    ngOnDestroy() {
        try {
            if (this.subscriptionSave) {
                this.subscriptionSave.unsubscribe();
            }
            if (this.subscriptionLoad) {
                this.subscriptionLoad.unsubscribe();
            }
        } catch (e) {
        }
        if (this.currentView) {
            this.currentView.svgcontent = this.winRef.nativeWindow.svgEditor.getSvgString();
            this.saveHmi();
        }
    }
    //#endregion

    //#region General private function
    /**
     * init, first init the svg-editor component 
     */
    private myInit() {
        // this.winRef.nativeWindow.svgEditor = null;
        console.log('myInit');
        try {
            // first init svg-editor component
            mypathseg.initPathSeg();
            mybrowser.initBrowser();
            mysvgutils.initSvgutils();
            myselect.initSelect();
            mydraw.initDraw();
            mysvgcanvas.initSvgCanvas();
            // init svg-editor
            let toinit = mysvgeditor.initSvgEditor($,
                (selected) => {
                    this.onSelectedElement(selected);
                    let ga: GaugeSettings = this.getGaugeSettings(selected);
                },
                (args) => {
                    this.onExtensionLoaded(args);
                    this.clearSelection();
                },
                (type, color) => {
                    if (type === 'fill') {
                        this.colorFill = color;
                        this.setFillColor(this.colorFill);
                        this.checkMySelectedToSetColor(this.colorFill, null, this.winRef.nativeWindow.svgEditor.getSelectedElements());
                        // console.log('fill ' + color);
                    } else if (type === 'stroke') {
                        this.colorStroke = color;
                        this.checkMySelectedToSetColor(null, this.colorStroke, this.winRef.nativeWindow.svgEditor.getSelectedElements());
                        // console.log('stroke ' + color);
                    }
                },
                (eleadded) => {
                    console.log('added: ' + eleadded.id + ' ' + eleadded.type);
                    let ga: GaugeSettings = this.getGaugeSettings(eleadded);
                    this.checkGaugeAdded(ga);
                    // this.hmiService.addGauge(this.hmi, eleadded);
                },
                (eleremoved) => {
                    this.onRemoveElement(eleremoved);
                }
            );
            // this.winRef.nativeWindow.svgEditor.ready(function() {
            //     this.winRef.nativeWindow.svgEditor.init();
            //     $(initLocale);
            //     $(initContextmenu);
            // });
            this.winRef.nativeWindow.svgEditor.init();
            $(initLocale);
            $(initContextmenu);
            console.log('myInit End');
        }
        catch (Error) {
            console.log(Error);
        }
        // mycontextmenu.initContextmenu();
        this.setFillColor(this.colorFill);
        this.setFillColor(this.colorStroke);
    }

    /**
     * load the hmi resource and bind it 
     */
    private loadHmi() {
        this.hmi = this.projectService.getHmi();
        // check new hmi
        if (!this.hmi.views || this.hmi.views.length <= 0) {
            this.hmi.views = [];
            this.onAddView();
            this.currentView = this.hmi.views[0];
            this.saveHmi();
            // this.selectView(this.hmi.views[0].name);
        } else {
            let oldsel = localStorage.getItem("@frango.webeditor.currentview");
            if (!oldsel && this.hmi.views.length) {
                oldsel = this.hmi.views[0].name;
            }
            for (let i = 0; i < this.hmi.views.length; i++) {
                if (this.hmi.views[i].name === oldsel) {
                    this.onSelectView(this.hmi.views[i]);
                    break;
                }
            }
        }
    }

    /**
     * save hmi
     */
    private saveHmi() {
        // console.log('savehmi');
        this.projectService.setHmi(this.hmi);
        this.projectService.save();
    }

    /**
     * get gauge settings from current view items, if not exist create void settings from GaugesManager
     * @param ele gauge id
     */
    private getGaugeSettings(ele) {
        if (ele && this.currentView) {
            if (this.currentView.items[ele.id]) {
                return this.currentView.items[ele.id];
            }
            return this.gaugesManager.createSettings(ele.id, ele.type);
        }
        return null;
    }

    /**
     * add the gauge settings to the current view items list
     * @param ele 
     */
    private setGaugeSettings(ele) {
        this.currentView.items[ele.id] = ele;
    }

    /**
     * check the gauge in current view of element
     * @param ele element to check
     */
    private checkGaugeInView(ele) {
        let g = this.getGaugeSettings(ele);
        if (!g) {

        }
    }

    /**
     * check and set the color panel with selected element
     * @param ele selected element
     */
    private checkColors(ele) {
        let eles = this.winRef.nativeWindow.svgEditor.getSelectedElements();
        let clrfill = null;
        let clrstroke = null;
        if (eles && (eles.length <= 1 || !eles[1]) && eles[0]) {
            // check for gauge fill and stroke color
            let colors = { fill: clrfill, stroke: clrstroke };
            if (GaugesManager.checkGaugeColor(ele, eles, colors)) {
                if (colors.fill) {
                    this.colorFill = colors.fill;
                }
                if (colors.stroke) {
                    this.colorStroke = colors.stroke;
                }
            } else {
                if (eles[0].attributes['fill']) {
                    clrfill = eles[0].attributes['fill'].value;
                    this.colorFill = clrfill;
                }
                if (eles[0].attributes['stroke']) {
                    clrstroke = eles[0].attributes['stroke'].value;
                    this.colorStroke = clrstroke;
                }
                // this.setFillColor(this.colorFill);
                // console.log('f:' + this.colorFill + ' s:' + this.colorStroke);
            }
        }
    }

    /**
     * load the view to svg-editor and canvas
     * @param view view to load
     */
    private loadView(view) {
        if (view) {
            this.clearEditor();
            // this.loadHmi();
            let svgcontent: string = '';
            let v = this.getView(view.name)
            if (v) {
                svgcontent = v.svgcontent;
            }
            if (svgcontent.length <= 0) {
                svgcontent = '<svg id="' + view.name + '" width="' + view.profile.width + '" height="' + view.profile.height +
                    '" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg"><g><title>Layer 1</title></g></svg>';
                // svgcontent = '<svg id="' + view.name + '" width="' + view.profile.width + '" height="' + view.profile.height +
                //     '" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg"><g><title>Layer 1</title>' +
                //     '<g transform="translate(267,179) scale(0.005) translate(-267,-179)" strokeWidth=\"2\" strokecolor=\"#000000\" fill=\"none\" type=\"svg-ext-switch\" id=\"svg_6\">' +
                //     '<path d="M1.07052,290.14898L1.0583,290.13018" id="svg_1" stroke-width="2" stroke="#000000" fill="none"/>' +
                //     '<path d="M1.0707,290.12L1.0707,290.12677" id="svg_2" stroke-width="2" stroke="#000000" fill="none"/>' +
                //     '<circle stroke_width="none" r="0.00165" cy="290.12825" cx="1.07065" id="svg_3" stroke-width="2" stroke="#000000" fill="none"/>' +
                //     '<path d="M1.0707,290.15724L1.0707,290.15046" id="svg_4" stroke-width="2" stroke="#000000" fill="none"/>' +
                //     '<circle transform="scale(1,-1)" r="0.00165" cy="-4777.94978" cx="17.44126" id="svg_5" stroke-width="2" stroke="#000000" fill="none"/>' +
                //     '</g>' +
                //     '</g></svg>';
            }
            this.winRef.nativeWindow.svgEditor.setDocProperty(view.name, view.profile.width, view.profile.height, view.profile.bkcolor);
            this.winRef.nativeWindow.svgEditor.setSvgString(svgcontent);

            // check gauge to init
            this.gaugesRef = [];
            setTimeout(() => {            
                for (let key in v.items) {
                    let ga: GaugeSettings = this.getGaugeSettings(v.items[key]);
                    this.checkGaugeAdded(ga);
                    // GaugesManager.initElementAdded(v.items[key], this.resolver, this.viewContainerRef);                
                }
            }, 500);

        }
    }

    /**
     * get view from hmi views list
     * @param name view name
     */
    private getView(name) {
        for (var i = 0; i < this.hmi.views.length; i++) {
            if (this.hmi.views[i].name === name) {
                return this.hmi.views[i];
            }
        }
        return null;
    }
    //#endregion

    //#region Svg-editor event and function interface 
    /**
     * set the mode to svg-editor (line,text,...)
     * @param mode mode to set
     */
    private setMode(mode: string) {
        this.currentMode = mode;
        this.winRef.nativeWindow.svgEditor.clickToSetMode(mode);
        // console.log('setmode: ' + mode);
    }

    /**
     * check with the current mode
     * @param mode mode to check
     */
    private isModeActive(mode) {
        return (this.currentMode === mode)
    }

    /**
     * clear svg-editor and the canvas
     */
    private clearEditor() {
        this.winRef.nativeWindow.svgEditor.clickClearAll();
    }

    /**
     * event from svg-editor by new selection svg element 
     * @param event svg element
     */
    private onSelectedElement(event) {
        this.selectedElement = null;
        try {
            // to remove some strange effects
            if (document.activeElement !== document.body) (document.activeElement as HTMLElement).blur();
        } catch (e) { }
        // console.log('selected: ' + this.selectedElement);
        if (event) {
            for (let i = 0; i < event.length; i++) {
                console.log('selected: ' + event[i].id + ' ' + event[i].type);
            }
            if (event.length <= 1) {
                this.selectedElement = event[0];
                this.selectedElement.type = event[0].type;
                this.checkColors(this.selectedElement);
                this.checkGaugeInView(this.selectedElement);
            }
        }
    }

    /**
     * event from svg-editor: for every loaded extension
     * @param args 
     */
    private onExtensionLoaded(args) {
        if (args && args.length) {
            // console.log('ext \'' + args[0] + '\' loaded');
        }
    }

    /**
     * event from svg-editor: change fill color
     * @param event color code
     */
    private onChangeFillColor(event) {
        this.setFillColor(event);
        this.checkMySelectedToSetColor(this.colorFill, null, this.winRef.nativeWindow.svgEditor.getSelectedElements());
    }

    /**
     * event change stroke color (from bottom color panel)
     * @param event color code
     */
    onChangeStrokeColor(event) {
        this.setStrokeColor(event);
        this.checkMySelectedToSetColor(null, this.colorStroke, this.winRef.nativeWindow.svgEditor.getSelectedElements());
    }


    /**
     * event from svg-editor: svg element removed
     * @param ele svg element
     */
    private onRemoveElement(ele: any) {
        if (this.currentView && this.currentView.items && ele) {
            for (let i = 0; i < ele.length; i++) {
                if (this.currentView.items[ele[i].id]) {
                    delete this.currentView.items[ele[i].id];
                    // console.log('deleted :> ' + ele[i].id);
                }
            }
        }
    }

    /**
     * set the fill color (to svg-editor)
     * @param event color code
     */
    private setFillColor(event) {
        let color = event;
        if (color.charAt(0) === '#')
            color = color.slice(1);
        let alfa = 100;
        this.winRef.nativeWindow.svgEditor.setColor(color, alfa, "fill");
        // this.fillcolor;
    }

    /**
     * set stroke color (to svg-editor)
     * @param event color code
     */
    setStrokeColor(event) {
        let color = event;
        if (color.charAt(0) === '#')
            color = color.slice(1);
        let alfa = 100;
        this.winRef.nativeWindow.svgEditor.setColor(color, alfa, "stroke");
        // this.fillcolor;
    }

    /**
     * set the marker to selected element (->, <->, <-)
     * @param id marker id (start,mid,end)
     * @param marker marker type
     */
    private onSetMarker(id, marker) {
        if (marker >= 0) {
            // console.log('marker select ' + id + ' ' + marker);
            this.winRef.nativeWindow.svgEditor.setMarker(id, marker);
        }
    }

    /**
     * align the selected element
     * @param letter align type (left,center,right,top,middle,bottom)
     */
    private onAlignSelected(letter: string) {
        this.winRef.nativeWindow.svgEditor.alignSelectedElements(letter.charAt(0));
    }

    /**
     * select the zoom area function
     */
    private onZoomSelect() {
        this.winRef.nativeWindow.svgEditor.clickZoom();
    }

    /**
     * show grid in canvas
     */
    private onShowGrid() {
        this.gridOn = this.gridOn = !this.gridOn;
        this.winRef.nativeWindow.svgEditor.clickExtension("view_grid");
        this.winRef.nativeWindow.svgEditor.enableGridSnapping(this.gridOn);
    }

    /**
     * add image to view
     * @param event selected file
     */
    private onSetImage(event) {
        if (event.target.files) {
            this.imagefile = 'assets/images/' + event.target.files[0].name;
            let self = this;
            if (this.imagefile.split('.').pop().toLowerCase() === 'svg') {
                let reader = new FileReader();
                reader.onloadend = function (e: any) {
                    self.winRef.nativeWindow.svgEditor.setSvgImageToAdd(e.target.result);
                    self.setMode('svg-image');
                };
                reader.readAsText(event.target.files[0]);
            } else {
                this.getBase64Image(event.target.files[0], function (imgdata) {
                    let data = imgdata;
                    self.winRef.nativeWindow.svgEditor.promptImgURLcallback = data;
                    self.setMode('image');
                });
            }
        }
    }

    /**
     * convert image file to code to attach in svg 
     * @param file image file
     * @param callback event for end load image
     */
    private getBase64Image(file, callback) {
        var fr = new FileReader();
        fr.onload = function () {
            callback(fr.result);
        }
        fr.readAsDataURL(file);
    }

    /**
     * set stroke to svg selected (joinmieter, joinround, joinbevel, capbutt, capsquare, capround)
     * @param option stroke type 
     */
    onSetStrokeOption(option) {
        this.winRef.nativeWindow.svgEditor.onSetStrokeOption(option);
    }

    /**
     * set shadow to svg selected
     * @param event shadow
     */
    onSetShadowOption(event) {
        this.winRef.nativeWindow.svgEditor.onSetShadowOption(event);
    }

    /**
     * set font to svg selected
     * @param font font family
     */
    onFontFamilyChange(font) {
        this.winRef.nativeWindow.svgEditor.setFontFamily(font);
    }

    /**
     * align the svg text (left,middle,right) 
     * @param align type
     */
    onTextAlignChange(align) {
        this.winRef.nativeWindow.svgEditor.setTextAlign(align);
    }

    checkMySelectedToSetColor(bkcolor, color, elems) {
        GaugesManager.initElementColor(bkcolor, color, elems);
        // for (let i = 0; i < elems.length; i++) {
        //     HtmlButtonComponent.initElementColor(bkcolor, color, elems[i]);
        //     GaugeProgressComponent.initElementColor(bkcolor, color, elems[i]);
        // }
    }

    /**
     * check and set the special gauge like ngx-dygraphs if added
     * @param ga 
     */
    checkGaugeAdded(ga: GaugeSettings) {
        let gauge = GaugesManager.initElementAdded(ga, this.resolver, this.viewContainerRef, null);
        if (gauge) {
            if (this.gaugesRef.indexOf(ga.id) === -1) {
                this.gaugesRef[ga.id] = { type: ga.type, ref: gauge };
            }
            this.setGaugeSettings(ga);
        }
    }
    //#endregion

    //#region Toolbar Top Events
    /**
     * save current project and launch the Test in new Windows 'lab'
     */
    onStartCurrent() {
        this.onSaveProject();
        this.winRef.nativeWindow.open('lab', 'MyTest', 'width=800,height=640,menubar=0');
    }
    //#endregion

    //#region Project Events
    /**
     * save Project
     */
    onSaveProject() {
        if (this.currentView) {
            this.currentView.svgcontent = this.winRef.nativeWindow.svgEditor.getSvgString();
        }
        this.saveHmi();
    }

    //#endregion

    //#region View Events (Add/Rename/Delete/...)
    /**
     * Add View to Project with a default name View_[x]
     */
    onAddView() {
        if (this.hmi.views) {
            let nn = "View_";
            let idx = 1;
            for (idx = 1; idx < this.hmi.views.length + 2; idx++) {
                let found = false;
                for (var i = 0; i < this.hmi.views.length; i++) {
                    if (this.hmi.views[i].name === nn + idx) {
                        found = true;
                        break;
                    }
                }
                if (!found)
                    break;
            }
            let v = new View();
            if (this.hmi.views.length <= 0) {
                v.name = 'MainView';
            } else {
                v.name = nn + idx;
                v.profile.bkcolor = '#ffffffff';
            }
            v.id = 'v_' + Date.now();
            this.hmi.views.push(v);
            this.onSelectView(v);
        }
    }

    /**
     * Delete the View from hmi.views list
     * @param view View to delete
     */
    onDeleteView(view) {

        var msg = '';
        this.translateService.get('msg.view-remove', { value: view.name }).subscribe((txt: string) => {msg = txt});
        let dialogRef = this.dialog.open(ConfirmDialogComponent, {
            minWidth: '350px',
            data: { msg: msg },
            position: { top: '80px' }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result && this.hmi.views) {
                let toselect = null;
                for (var i = 0; i < this.hmi.views.length; i++) {
                    if (this.hmi.views[i].name == view.name) {
                        this.hmi.views.splice(i, 1);
                        if (i > 0) {
                            toselect = this.hmi.views[i - 1];
                        }
                        break;
                    }
                }
                // if (toselect) {
                //     this.onSelectView(toselect);
                // }
                this.saveHmi();
            }            
        });
    }

    /**
     * Rename the View (only name)
     * @param view View to rename
     */
    onRenameView(view) {
        let dialogRef = this.dialog.open(DialogDocName, {
            minWidth: '250px',
            data: { name: view.name }
        });

        dialogRef.afterClosed().subscribe(result => {
            view.name = result.name;
            this.saveHmi();
        });
    }

    /**
     * Edit View property
     * @param view View to change property (height, width, background)
     */
    onPropertyView(view) {
        let dialogRef = this.dialog.open(DialogDocProperty, {
            minWidth: '250px',
            data: { name: view.name, width: view.profile.width, height: view.profile.height, bkcolor: view.profile.bkcolor }
        });

        dialogRef.afterClosed().subscribe(result => {
            view.profile.width = parseInt(result.width);
            view.profile.height = parseInt(result.height);
            view.profile.bkcolor = result.bkcolor;
            this.winRef.nativeWindow.svgEditor.setDocProperty(view.name, view.profile.width, view.profile.height, view.profile.bkcolor);
            this.saveHmi();
        });
        // this.winRef.nativeWindow.svgEditor.showDocProperties();
    }

    /**
     * select the view, save current vieww before
     * @param view selected view to load resource
     */
    private onSelectView(view) {
        if (this.currentView) {
            this.currentView.svgcontent = this.winRef.nativeWindow.svgEditor.getSvgString();
            // this.hmi.views[this.currentView].svgcontent = this.winRef.nativeWindow.svgEditor.getSvgString();
        } else {
            this.setFillColor(this.colorFill);
            // this.setFillColor(this.colorStroke);
        }
        if (this.currentView) {
            this.saveHmi();
        }
        this.currentView = view;
        localStorage.setItem("@frango.webeditor.currentview", this.currentView.name);
        this.loadView(this.currentView);
    }

    /**
     * check with the current view
     * @param view view to check
     */
    isViewActive(view) {
        return (this.currentView && this.currentView.name == view.name);
    }

    /**
     * edit the layout property of project views
     */
    onLayoutProperty() {
        // console.log('The Edit Device open');
        let templayout = null;
        if (this.hmi.layout) {
            templayout = JSON.parse(JSON.stringify(this.hmi.layout));
        }
        let dialogRef = this.dialog.open(LayoutPropertyComponent, {
            // minWidth: '700px',
            // minHeight: '700px',
            panelClass: 'dialog-property',
            data: { layout: templayout, views: this.hmi.views },
            position: { top: '80px' }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.hmi.layout = JSON.parse(JSON.stringify(result.layout));
                this.saveHmi();
            }
        });
    }

    //#endregion

    //#region Panels State
    /**
     * Load the left panels state copied in localstorage  
     */
    loadPanelState() {
        let ps = localStorage.getItem("@frango.webeditor.panelsState");
        this.panelsState.enabled = true;
        if (ps) {
            this.panelsState = JSON.parse(ps);
        }
    }

    /**
     * Save the panels state in localstorage (after every toggled)
     */
    savePanelState() {
        if (this.panelsState.enabled) {
            localStorage.setItem("@frango.webeditor.panelsState", JSON.stringify(this.panelsState));
            console.log('set panelsState');
        }
    }
    //#endregion

    //#region Interactivity
    /**
     * to check from DOM and to control open close interaction panel
     * @param ele selected gauge element
     */
    private isInteractivtyEnabled(ele) {
        if (ele && ele.type) {
            return this.gaugesManager.isGauge(ele.type);
        }
        return false;
    }

    /**
     * callback to open edit gauge property form (from GaugeBase)
     * @param event 
     */
    onGaugeEdit(event) {
        // console.log('edit gauge: ' + event); // [i].id + ' ' + event[i].type);
        let settings = this.gaugePanelComponent.settings;
        this.openEditGauge(settings, data => {
            this.setGaugeSettings(data);
        });
    }

    /**
     * callback to open edit gauge property form (from selected element context menu)
     */
    onGaugeEditEx() {
        setTimeout(() => {
            this.gaugePanelComponent.onEdit();
        }, 500)
    }

    isWithEvents(type) {
        return this.gaugesManager.isWithEvents(type);
    }

    openEditGauge(settings, callback) {
        // console.log('The Edit Gauge open');
        let tempsettings = JSON.parse(JSON.stringify(settings));
        let hmi = this.projectService.getHmi();
        let dlgType = GaugesManager.getEditDialogTypeToUse(settings.type);
        let eventsSupported = this.isWithEvents(settings.type);
        let defaultValue = GaugesManager.getDefaultValue(settings.type);
        // settings.property = JSON.parse(settings.property);
        let dialogRef = this.dialog.open(GaugePropertyComponent, {
            // data: { settings: tempsettings, signals: this.signals, views: hmi.views }
            minWidth: '700px',
            minHeight: '700px',
            panelClass: 'dialog-property',
            data: {
                settings: tempsettings, devices: Object.values(this.projectService.getDevices()),
                views: hmi.views, dlgType: dlgType, withEvents: eventsSupported, default: defaultValue
            },
            position: { top: '80px' }
            // data: data

        });

        dialogRef.afterClosed().subscribe(result => {
            // console.log('The Edit Gauge was closed');
            if (result) {
                callback(result.settings);
                if (this.gaugesManager.isToInitInEditor(result.settings)) {
                    this.gaugesManager.checkElementToInit(result.settings);
                }
            }
            // } else {
            //   settings = JSON.parse(JSON.stringify(oldvalue));
            // }
        });
    }
    //#endregion

    isWithShadow() {
        if (this.selectedElement) {

        }
        return false;
    }

    private fileNew() {
    }

    private checkValid(hmi) {
        if (!hmi.views) {
            hmi.views = [];
            return false;
        }
        return true;
    }

    private clearSelection() {
        this.winRef.nativeWindow.svgEditor.clearSelection();
    }

    cloneElement() {
        this.winRef.nativeWindow.svgEditor.clickExtension("view_grid");
    }

    flipSelected(fliptype: string) {
    }
}

@Component({
    selector: 'dialog-doc-property',
    templateUrl: 'docproperty.dialog.html',
})
export class DialogDocProperty {
    defaultColor = Utils.defaultColor;
    constructor(
        public dialogRef: MatDialogRef<DialogDocProperty>,
        @Inject(MAT_DIALOG_DATA) public data: any) { }

    onNoClick(): void {
        this.dialogRef.close();
    }

}

@Component({
    selector: 'dialog-doc-name',
    templateUrl: 'docname.dialog.html',
})
export class DialogDocName {
    constructor(
        public dialogRef: MatDialogRef<DialogDocName>,
        @Inject(MAT_DIALOG_DATA) public data: any) { }

    onNoClick(): void {
        this.dialogRef.close();
    }

}

//#region Model Help
// export class PanelState {
//     width: Number = 640;
//     height: Number = 480;
//     bkcolor: String = '';
// }
//#endregion