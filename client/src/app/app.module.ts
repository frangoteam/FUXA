// the start/root module that tells Angular how to assemble the application.

import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { MaterialModule } from './material.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ColorPickerModule } from 'ngx-color-picker';

import { Ng5SliderModule } from 'ng5-slider';
import { ToastrModule } from 'ngx-toastr';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { HAMMER_GESTURE_CONFIG } from '@angular/platform-browser';
import { GestureConfig } from '@angular/material';
import { AngularDraggableModule } from 'angular2-draggable';

import { AppComponent } from './app.component';
import { routing } from './app.routing';
import { AuthGuard } from './auth.guard';

import { HomeComponent } from './home/home.component';
import { HeaderComponent, DialogInfo } from './header/header.component';
import { IframeComponent } from './iframe/iframe.component';
import { ViewComponent } from './view/view.component';
import { SidenavComponent } from './sidenav/sidenav.component';
import { EditorComponent, DialogDocProperty, DialogDocName, DialogLinkProperty } from './editor/editor.component';
import { LayoutPropertyComponent, DialogMenuItem } from './editor/layout-property/layout-property.component';
import { ChartConfigComponent, DialogListItem } from './editor/chart-config/chart-config.component';
import { AlarmViewComponent } from './alarms/alarm-view/alarm-view.component';
import { AlarmListComponent } from './alarms/alarm-list/alarm-list.component';
import { AlarmPropertyComponent } from './alarms/alarm-property/alarm-property.component';
import { TextListComponent, DialogItemText } from './text-list/text-list.component';
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
import { UserService } from './_services/user.service';
import { AuthService } from './_services/auth.service';
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
import { NgxDygraphsComponent } from './gui-helpers/ngx-dygraphs/ngx-dygraphs.component';
import { SelOptionsComponent } from './gui-helpers/sel-options/sel-options.component';
import { NgxSwitchComponent } from './gui-helpers/ngx-switch/ngx-switch.component';

import { DialogDraggableDirective } from './_directives/dialog-draggable.directive';
import { ModalPositionCache } from './_directives/modal-position.cache';
import { DraggableDirective } from './_directives/ngx-draggable.directive';
import { NumberOnlyDirective } from './_directives/number.directive';
import { LazyForDirective } from './_directives/lazyFor.directive';

import { GaugesManager } from './gauges/gauges.component';
import { GaugeBaseComponent } from './gauges/gauge-base/gauge-base.component';
import { ValueComponent } from './gauges/controls/value/value.component';

import { GaugePropertyComponent, DialogGaugePermission } from './gauges/gauge-property/gauge-property.component';
import { ChartPropertyComponent } from './gauges/controls/html-chart/chart-property/chart-property.component';
import { FlexInputComponent } from './gauges/gauge-property/flex-input/flex-input.component';
import { FlexAuthComponent } from './gauges/gauge-property/flex-auth/flex-auth.component';
import { FlexHeadComponent } from './gauges/gauge-property/flex-head/flex-head.component';
import { FlexEventComponent } from './gauges/gauge-property/flex-event/flex-event.component';
import { FlexActionComponent } from './gauges/gauge-property/flex-action/flex-action.component';
import { FlexVariableComponent } from './gauges/gauge-property/flex-variable/flex-variable.component';
import { MatSelectSearchModule } from './gui-helpers/mat-select-search/mat-select-search.module';
import { HtmlInputComponent } from './gauges/controls/html-input/html-input.component';
import { HtmlButtonComponent } from './gauges/controls/html-button/html-button.component';
import { HtmlSelectComponent } from './gauges/controls/html-select/html-select.component';
import { HtmlChartComponent } from './gauges/controls/html-chart/html-chart.component';
import { HtmlBagComponent } from './gauges/controls/html-bag/html-bag.component';
import { HtmlSwitchComponent } from './gauges/controls/html-switch/html-switch.component';
import { GaugeProgressComponent } from './gauges/controls/gauge-progress/gauge-progress.component';
import { GaugeSemaphoreComponent } from './gauges/controls/gauge-semaphore/gauge-semaphore.component';
import { UsersComponent, DialogUser } from './users/users.component';
import { LoginComponent } from './login/login.component';
import { DialogUserInfo } from './home/home.component';
import { ShapesComponent } from './gauges/shapes/shapes.component';
import { ProcEngComponent } from './gauges/shapes/proc-eng/proc-eng.component';
import { ApeShapesComponent } from './gauges/shapes/ape-shapes/ape-shapes.component';

import { NgxGaugeComponent } from './gui-helpers/ngx-gauge/ngx-gauge.component';
import { NgxNouisliderComponent } from './gui-helpers/ngx-nouislider/ngx-nouislider.component';
import { BagPropertyComponent } from './gauges/controls/html-bag/bag-property/bag-property.component';
import { PipePropertyComponent } from './gauges/controls/pipe/pipe-property/pipe-property.component';
import { PipeComponent } from './gauges/controls/pipe/pipe.component';
import { SliderComponent } from './gauges/controls/slider/slider.component';
import { SliderPropertyComponent } from './gauges/controls/slider/slider-property/slider-property.component';
import { HtmlSwitchPropertyComponent } from './gauges/controls/html-switch/html-switch-property/html-switch-property.component';

import { httpInterceptorProviders } from './_helpers/auth-interceptor';

export function createTranslateLoader(http: HttpClient) {
    return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

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
      DialogLinkProperty,
      ConfirmDialogComponent,
      DialogInfo,
      GaugeBaseComponent,
      HtmlInputComponent,
      HtmlButtonComponent,
      HtmlSelectComponent,
      HtmlChartComponent,
      HtmlBagComponent,
      GaugeProgressComponent,
      GaugeSemaphoreComponent,
      GaugePropertyComponent,
      DialogGaugePermission,
      ChartPropertyComponent,
      BagPropertyComponent,
      PipePropertyComponent,
      SliderPropertyComponent,
      HtmlSwitchPropertyComponent,
      ShapesComponent,
      ProcEngComponent,
      ApeShapesComponent,
      TesterComponent,
      TutorialComponent,
      FlexInputComponent,
      FlexAuthComponent,
      FlexHeadComponent,
      FlexEventComponent,
      FlexActionComponent,
      FlexVariableComponent,
      ValueComponent,
      DialogDraggableDirective,
      EnumToArrayPipe,
      DraggableDirective,
      NumberOnlyDirective,
      NgxFabButtonComponent,
      NgxFabItemButtonComponent,
      TreetableComponent,
      SelOptionsComponent,
      LazyForDirective,
      NgxDygraphsComponent,
      NgxSwitchComponent,
      ChartConfigComponent,
      AlarmListComponent,
      AlarmViewComponent,
      AlarmPropertyComponent,
      TextListComponent,
      NgxGaugeComponent,
      NgxNouisliderComponent,
      DialogListItem,
      UsersComponent,
      DialogUser,
      LoginComponent,
      DialogUserInfo,
      ViewComponent,
      DialogItemText
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
      AngularDraggableModule,
      MatSelectSearchModule,
       ToastrModule.forRoot({
           timeOut: 3000,
           positionClass: "toast-bottom-right",
           preventDuplicates: false
       }),
        TranslateModule.forRoot({
            loader: {
                provide: TranslateLoader,
                useFactory: createTranslateLoader,
                deps: [HttpClient]
            }
        })
    ],
    providers: [
        HmiService,
        ProjectService,
        UserService,
        TesterService,
        customHttpProvider,
        httpInterceptorProviders,
        AuthService,
        GaugesManager,
        WindowRef,
        Utils,
        HtmlSwitchComponent,
        PipeComponent,
        SliderComponent,
        Dictionary,
        ModalPositionCache,
        Define,
        AuthGuard,
        { provide: HAMMER_GESTURE_CONFIG, useClass: GestureConfig }
    ],
    entryComponents: [
        DialogDocProperty,
        DialogDocName,
        DialogLinkProperty,
        DialogInfo,
        GaugePropertyComponent,
        DialogGaugePermission,
        ChartPropertyComponent,
        NgxGaugeComponent,
        NgxNouisliderComponent,
        BagPropertyComponent,
        PipePropertyComponent,
        SliderPropertyComponent,
        HtmlSwitchPropertyComponent,
        DevicePropertyComponent,
        TagPropertyComponent,
        ConfirmDialogComponent,
        LayoutPropertyComponent,
        DialogMenuItem,
        NgxDygraphsComponent,
        NgxSwitchComponent,
        ChartConfigComponent,
        AlarmListComponent,
        AlarmViewComponent,
        AlarmPropertyComponent,
        TextListComponent,
        DialogListItem,
        DialogUser,
        LoginComponent,
        DialogUserInfo,
        DialogItemText
    ],
    bootstrap: [AppComponent]
})
export class AppModule { }
