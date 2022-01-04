// the start/root module that tells Angular how to assemble the application.

import { NgModule, Provider } from '@angular/core';
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
import { LogsViewComponent } from './logs-view/logs-view.component';
import { SidenavComponent } from './sidenav/sidenav.component';
import { EditorComponent, DialogDocProperty, DialogDocName, DialogNewDoc, DialogLinkProperty } from './editor/editor.component';
import { LayoutPropertyComponent, DialogMenuItem } from './editor/layout-property/layout-property.component';
import { PluginsComponent } from './editor/plugins/plugins.component';
import { AppSettingsComponent } from './editor/app-settings/app-settings.component';
import { SetupComponent } from './editor/setup/setup.component';
import { ChartConfigComponent, DialogChartLine } from './editor/chart-config/chart-config.component';
import { CardConfigComponent } from './editor/card-config/card-config.component';
import { AlarmViewComponent } from './alarms/alarm-view/alarm-view.component';
import { AlarmListComponent } from './alarms/alarm-list/alarm-list.component';
import { AlarmPropertyComponent } from './alarms/alarm-property/alarm-property.component';
import { NotificationListComponent } from './notifications/notification-list/notification-list.component';
import { NotificationPropertyComponent } from './notifications/notification-property/notification-property.component';
import { TextListComponent, DialogItemText } from './text-list/text-list.component';
import { LabComponent } from './lab/lab.component';
import { DeviceComponent, DeviceTagDialog } from './device/device.component';
import { DevicePropertyComponent } from './device/device-property/device-property.component';
import { TagPropertyComponent } from './device/tag-property/tag-property.component';
import { TagOptionsComponent } from './device/tag-options/tag-options.component';
import { TopicPropertyComponent } from './device/topic-property/topic-property.component';
import { DeviceListComponent, DialogTagName } from './device/device-list/device-list.component';
import { DeviceMapComponent } from './device/device-map/device-map.component';
import { FuxaViewComponent } from './fuxa-view/fuxa-view.component';
import { CardsViewComponent } from './cards-view/cards-view.component';
import { TesterComponent } from './tester/tester.component';
import { customHttpProvider } from './_helpers/custom-http';
import { TesterService } from './tester/tester.service';
import { UserService } from './_services/user.service';
import { SettingsService } from './_services/settings.service';
import { PluginService } from './_services/plugin.service';
import { AuthService } from './_services/auth.service';
import { DiagnoseService } from './_services/diagnose.service';
import { ResWebApiService } from './_services/rcgi/reswebapi.service';
import { ResDemoService } from './_services/rcgi/resdemo.service';
import { ResClientService } from './_services/rcgi/resclient.service';
import { ResourceStorageService } from './_services/rcgi/resource-storage.service';
import { ProjectService } from './_services/project.service';
import { HmiService } from './_services/hmi.service';
import { AppService } from './_services/app.service';
import { TutorialComponent } from './help/tutorial/tutorial.component';
import { WindowRef } from './_helpers/windowref';
import { Utils, EnumToArrayPipe, EscapeHtmlPipe } from './_helpers/utils';
import { Define } from './_helpers/define';
import { Dictionary } from './_helpers/dictionary';
import { NgxFabButtonComponent } from './gui-helpers/fab-button/ngx-fab-button.component';
import { NgxFabItemButtonComponent } from './gui-helpers/fab-button/ngx-fab-item-button.component';
import { TreetableComponent } from './gui-helpers/treetable/treetable.component';
import { ConfirmDialogComponent } from './gui-helpers/confirm-dialog/confirm-dialog.component';
import { SelOptionsComponent } from './gui-helpers/sel-options/sel-options.component';
import { NgxSwitchComponent } from './gui-helpers/ngx-switch/ngx-switch.component';
import { EditNameComponent } from './gui-helpers/edit-name/edit-name.component';

import { DialogDraggableDirective } from './_directives/dialog-draggable.directive';
import { ModalPositionCache } from './_directives/modal-position.cache';
import { DraggableDirective } from './_directives/ngx-draggable.directive';
import { NumberOnlyDirective } from './_directives/number.directive';
import { LazyForDirective } from './_directives/lazyFor.directive';

import { GaugesManager } from './gauges/gauges.component';
import { GaugeBaseComponent } from './gauges/gauge-base/gauge-base.component';
import { ValueComponent } from './gauges/controls/value/value.component';

import { FlexVariablesMappingComponent } from './gauges/gauge-property/flex-variables-mapping/flex-variables-mapping.component';
import { FlexVariableMapComponent } from './gauges/gauge-property/flex-variable-map/flex-variable-map.component';
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
import { HtmlGraphComponent } from './gauges/controls/html-graph/html-graph.component';
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

import { NgxUplotComponent } from './gui-helpers/ngx-uplot/ngx-uplot.component';
import { ChartUplotComponent } from './gauges/controls/html-chart/chart-uplot/chart-uplot.component';

import { GridsterModule } from 'angular-gridster2';

import { httpInterceptorProviders } from './_helpers/auth-interceptor';
import { environment } from '../environments/environment';
import { GraphBarComponent } from './gauges/controls/html-graph/graph-bar/graph-bar.component';
import { GraphPieComponent } from './gauges/controls/html-graph/graph-pie/graph-pie.component';
import { NgxChartjsComponent } from './gui-helpers/ngx-chartjs/ngx-chartjs.component';

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
        DeviceTagDialog,
        TagPropertyComponent,
        TagOptionsComponent,
        TopicPropertyComponent,
        DevicePropertyComponent,
        LayoutPropertyComponent,
        PluginsComponent,
        AppSettingsComponent,
        SetupComponent,
        DialogMenuItem,
        DeviceListComponent,
        DialogTagName,
        DeviceMapComponent,
        FuxaViewComponent,
        DialogDocProperty,
        DialogDocName,
        DialogNewDoc,
        DialogLinkProperty,
        EditNameComponent,
        ConfirmDialogComponent,
        DialogInfo,
        GaugeBaseComponent,
        HtmlInputComponent,
        HtmlButtonComponent,
        HtmlSelectComponent,
        HtmlChartComponent,
        HtmlGraphComponent,
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
        FlexVariablesMappingComponent,
        FlexVariableMapComponent,
        ValueComponent,
        DialogDraggableDirective,
        EnumToArrayPipe,
        EscapeHtmlPipe,
        DraggableDirective,
        NumberOnlyDirective,
        NgxFabButtonComponent,
        NgxFabItemButtonComponent,
        TreetableComponent,
        SelOptionsComponent,
        LazyForDirective,
        NgxSwitchComponent,
        ChartConfigComponent,
        CardConfigComponent,
        AlarmListComponent,
        AlarmViewComponent,
        AlarmPropertyComponent,
        NotificationListComponent,
        NotificationPropertyComponent,
        TextListComponent,
        LogsViewComponent,
        NgxGaugeComponent,
        NgxNouisliderComponent,
        DialogChartLine,
        UsersComponent,
        DialogUser,
        LoginComponent,
        DialogUserInfo,
        ViewComponent,
        DialogItemText,
        NgxUplotComponent,
        NgxChartjsComponent,
        ChartUplotComponent,
        CardsViewComponent,
        GraphBarComponent,
        GraphPieComponent
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
        }),
        GridsterModule
    ],
    providers: [
        // providersResourceService,
        ResClientService,
        ResWebApiService,
        ResDemoService,
        HmiService,
        AppService,
        ProjectService,
        UserService,
        DiagnoseService,
        PluginService,
        SettingsService,
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
        DialogNewDoc,
        DialogTagName,
        DialogLinkProperty,
        DialogInfo,
        DeviceTagDialog,
        GaugePropertyComponent,
        DialogGaugePermission,
        ChartPropertyComponent,
        NgxGaugeComponent,
        NgxNouisliderComponent,
        BagPropertyComponent,
        PipePropertyComponent,
        SliderPropertyComponent,
        HtmlSwitchPropertyComponent,
        TagOptionsComponent,
        DevicePropertyComponent,
        TagPropertyComponent,
        TopicPropertyComponent,
        ConfirmDialogComponent,
        EditNameComponent,
        LayoutPropertyComponent,
        PluginsComponent,
        AppSettingsComponent,
        SetupComponent,
        DialogMenuItem,
        NgxSwitchComponent,
        ChartConfigComponent,
        CardConfigComponent,
        AlarmListComponent,
        AlarmViewComponent,
        AlarmPropertyComponent,
        NotificationListComponent,
        NotificationPropertyComponent,
        TextListComponent,
        DialogChartLine,
        DialogUser,
        LoginComponent,
        DialogUserInfo,
        DialogItemText,
        ChartUplotComponent,
        NgxUplotComponent,
        NgxChartjsComponent,
        GraphBarComponent,
        GraphPieComponent
    ],
    bootstrap: [AppComponent]
})
export class AppModule { }
