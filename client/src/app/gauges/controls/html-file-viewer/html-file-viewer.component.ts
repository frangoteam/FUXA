import { ViewContainerRef, ComponentFactoryResolver, Component } from '@angular/core';

import { GaugeSettings, Variable } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';
import { FileViewerComponent } from './file-viewer/file-viewer.component';
import { GaugeFileViewerProperty } from '../../../_models/hmi';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component';

@Component({
    selector: 'file-viewer',
    templateUrl: './html-file-viewer.component.html',
    styleUrls: ['./html-file-viewer.component.css']
})
export class HtmlFileViewerComponent extends GaugeBaseComponent {
    static TypeTag = 'svg-ext-own_ctrl-file-viewer';
    static LabelTag = 'HtmlFileViewer';
    static prefixD = 'D-OXC_';

    static getSignals(pro: any) {
        return [];
    }

    static getDialogType(): GaugeDialogType {
        return GaugeDialogType.FileViewer;
    }

    static processValue(ga: GaugeSettings, svgele: any, sig: Variable) {
        // No signals for file viewer
    }

    static initElement(gab: GaugeSettings, resolver: ComponentFactoryResolver, viewContainerRef: ViewContainerRef, isview: boolean): any {
        let ele = document.getElementById(gab.id);
        if (ele) {
            ele?.setAttribute('data-name', gab.name);
            let htmlFileViewer = Utils.searchTreeStartWith(ele, this.prefixD);
            if (!htmlFileViewer) {
                // Create the element if it doesn't exist
                htmlFileViewer = document.createElement('div');
                htmlFileViewer.id = this.prefixD + gab.id;
                htmlFileViewer.style.width = '100%';
                htmlFileViewer.style.height = '100%';
                htmlFileViewer.style.position = 'relative';
                htmlFileViewer.style.overflow = 'hidden';
                ele.appendChild(htmlFileViewer);
                console.log('Created element:', htmlFileViewer);
            }
            if (htmlFileViewer) {
                // if (!isview) {
                //     // In editor, just show placeholder
                //     htmlFileViewer.innerHTML = 'File Viewer';
                // } else {
                    // In runtime, create Angular component
                    if (!resolver || !viewContainerRef) {
                        console.error('Missing resolver or viewContainerRef for runtime component creation');
                        return null;
                    }
                    let factory = resolver.resolveComponentFactory(FileViewerComponent);
                    const componentRef = viewContainerRef.createComponent(factory);

                    if (!gab.property) {
                        gab.property = <GaugeFileViewerProperty>{
                            directory: '/_reports/generated',
                            headerText: 'File Viewer',
                            viewEnabled: false,
                            deleteEnabled: false,
                            permission: 0,
                            accentColor: '#556e82',
                            backgroundColor: '#f0f0f0',
                            borderColor: '#cccccc',
                            textColor: '#505050',
                            secondaryTextColor: '#ffffff',
                            fileTypeFilter: 'all',
                            dateFilter: {
                                enabled: false,
                                startDate: '',
                                endDate: ''
                            }
                        };
                    }

                    htmlFileViewer.innerHTML = '';
                    (<FileViewerComponent>componentRef.instance).settings = gab;
                    componentRef.changeDetectorRef.detectChanges();
                    htmlFileViewer.appendChild(componentRef.location.nativeElement);

                    componentRef.instance.isEditor = !isview;
                    componentRef.instance['myComRef'] = componentRef;
                    componentRef.instance['name'] = gab.name;
                    return componentRef.instance;
                // }
                // For editor mode, create a basic component for property editing
                if (!resolver || !viewContainerRef) {
                    return null;
                }
                try {
                    let factory = resolver.resolveComponentFactory(FileViewerComponent);
                    const componentRef = viewContainerRef.createComponent(factory);

                    if (!gab.property) {
                        gab.property = <GaugeFileViewerProperty>{
                            directory: '/_reports/generated',
                            headerText: 'File Viewer',
                            viewEnabled: false,
                            deleteEnabled: false,
                            permission: 0,
                            accentColor: '#556e82',
                            backgroundColor: '#f0f0f0',
                            borderColor: '#cccccc',
                            textColor: '#505050',
                            secondaryTextColor: '#ffffff',
                            fileTypeFilter: 'all',
                            dateFilter: {
                                enabled: false,
                                startDate: '',
                                endDate: ''
                            }
                        };
                    }

                    htmlFileViewer.innerHTML = '';
                    (<FileViewerComponent>componentRef.instance).settings = gab;
                    componentRef.changeDetectorRef.detectChanges();
                    htmlFileViewer.appendChild(componentRef.location.nativeElement);

                    componentRef.instance['myComRef'] = componentRef;
                    componentRef.instance['name'] = gab.name;
                    return componentRef.instance;
                } catch (error) {
                    console.error('Error creating editor component:', error);
                    return null;
                }
            }
        } else {
            console.error('Element not found:', gab.id);
        }
        return null;
    }

    static detectChange(gab: GaugeSettings, res: any, ref: any): FileViewerComponent {
        return HtmlFileViewerComponent.initElement(gab, res, ref, false);
    }
}
