// the start/root module that tells Angular how to assemble the application.

import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { MaterialModule } from './material.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ColorPickerModule } from 'ngx-color-picker';

import { Ng5SliderModule } from 'ng5-slider';
import { ToastrModule } from 'ngx-toastr';
import { DndModule } from 'ngx-drag-drop';

import { AppComponent } from './app.component';
import { routing } from './app.routing';

import { HomeComponent } from './home/home.component';
import { HeaderComponent, DialogInfo } from './header/header.component';
import { IframeComponent } from './iframe/iframe.component';
import { SidenavComponent } from './sidenav/sidenav.component';
import { EditorComponent, DialogDocProperty, DialogDocName } from './editor/editor.component';
import { LayoutPropertyComponent, DialogMenuItem } from './editor/layout-property/layout-property.component';
import { LabComponent } from './lab/lab.component';
import { DeviceComponent } from './device/device.component';
import { DevicePropertyComponent } from './device/device-property/device-property.component';
import { TagPropertyComponent } from './device/tag-property/tag-property.component';
import { DeviceListComponent } from './device/device-list/device-list.component';
import { DeviceMapComponent } from './device/device-map/device-map.component';
import { FuxaViewComponent } from './fuxa-view/fuxa-view.component';
import { TesterComponent } from './tester/tester.component';
import { customHttpProvider } from './_helpers/custom-http';
import { TesterService } from './tester/tester.service';
import { ProjectService } from './_services/project.service';
import { HmiService } from './_services/hmi.service';
import { TutorialComponent } from './help/tutorial/tutorial.component';
import { WindowRef } from './_helpers/windowref';
import { Utils, EnumToArrayPipe } from './_helpers/utils';
import { Define } from './_helpers/define';
import { Dictionary } from './_helpers/dictionary';
import { NgxFabButtonComponent } from './gui-helpers/fab-button/ngx-fab-button.component';
import { NgxFabItemButtonComponent } from './gui-helpers/fab-button/ngx-fab-item-button.component';
import { TreetableComponent } from './gui-helpers/treetable/treetable.component';
import { ConfirmDialogComponent } from './gui-helpers/confirm-dialog/confirm-dialog.component';

import { DialogDraggableDirective } from './_directives/dialog-draggable.directive';
import { ModalPositionCache } from './_directives/modal-position.cache';
import { DraggableDirective } from './_directives/ngx-draggable.directive';
import { NumberOnlyDirective } from './_directives/number.directive';
import { LazyForDirective } from './_directives/lazyFor.directive';

import { GaugesManager } from './gauges/gauges.component';
import { GaugeBaseComponent } from './gauges/gauge-base/gauge-base.component';
import { DynamicComponent } from './dynamic/dynamic.component';
import { SwitchComponent } from './gauges/switch/switch.component';
import { ValueComponent } from './gauges/controls/value/value.component';

import { CompressorComponent } from './gauges/proc-eng/compressor/compressor.component';
import { ExchangerComponent } from './gauges/proc-eng/exchanger/exchanger.component';
import { ValveComponent } from './gauges/proc-eng/valve/valve.component';
import { MotorComponent } from './gauges/proc-eng/motor/motor.component';
import { GaugePropertyComponent } from './gauges/gauge-property/gauge-property.component';
import { FlexInputComponent } from './gauges/gauge-property/flex-input/flex-input.component';
import { FlexHeadComponent } from './gauges/gauge-property/flex-head/flex-head.component';
import { FlexEventComponent } from './gauges/gauge-property/flex-event/flex-event.component';
import { MatSelectSearchModule } from './gui-helpers/mat-select-search/mat-select-search.module';
import { HtmlInputComponent } from './gauges/controls/html-input/html-input.component';
import { HtmlButtonComponent } from './gauges/controls/html-button/html-button.component';
import { HtmlSelectComponent } from './gauges/controls/html-select/html-select.component';
import { GaugeProgressComponent } from './gauges/controls/gauge-progress/gauge-progress.component';
import { GaugeSemaphoreComponent } from './gauges/controls/gauge-semaphore/gauge-semaphore.component';

@NgModule({
  declarations: [
    HomeComponent,
    EditorComponent,
    HeaderComponent,
    SidenavComponent,
    IframeComponent,
    AppComponent,
    LabComponent,
    DeviceComponent,
    TagPropertyComponent,
    DevicePropertyComponent,
    LayoutPropertyComponent,
    DialogMenuItem,
    DeviceListComponent,
    DeviceMapComponent,
    FuxaViewComponent,
    DialogDocProperty,
    DialogDocName,
    ConfirmDialogComponent,
    DialogInfo,
    GaugeBaseComponent,
    SwitchComponent,
    CompressorComponent,
    ValveComponent,
    MotorComponent,
    ExchangerComponent,
    HtmlInputComponent,
    HtmlButtonComponent,
    HtmlSelectComponent,
    GaugeProgressComponent,
    GaugeSemaphoreComponent,
    GaugePropertyComponent,
    TesterComponent,
    TutorialComponent,
    FlexInputComponent,
    FlexHeadComponent,
    FlexEventComponent,
    DynamicComponent,
    ValueComponent,
    DialogDraggableDirective,
    EnumToArrayPipe,
    DraggableDirective,
    NumberOnlyDirective,
    NgxFabButtonComponent,
    NgxFabItemButtonComponent,
    TreetableComponent,
    LazyForDirective
  ],
  imports: [
    BrowserModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    routing,    
    MaterialModule,
    BrowserAnimationsModule,
    ColorPickerModule,
    Ng5SliderModule,
    MatSelectSearchModule,
    ToastrModule.forRoot({
      timeOut: 3000,
      positionClass: 'toast-bottom-right',
      preventDuplicates: false,
    }),
    DndModule
  ],
  providers: [
    HmiService,
    ProjectService,
    TesterService,
    customHttpProvider,
    GaugesManager,    
    WindowRef,
    Utils,
    Dictionary,
    ModalPositionCache,
    Define
  ],
  entryComponents: [
    DialogDocProperty, 
    DialogDocName,
    DialogInfo,
    DynamicComponent,
    GaugePropertyComponent,
    DevicePropertyComponent,
    TagPropertyComponent,
    ConfirmDialogComponent,
    LayoutPropertyComponent,
    DialogMenuItem
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
