// the start/root module that tells Angular how to assemble the application.

import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { MaterialModule } from './material.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ColorPickerModule } from 'ngx-color-picker';

import { ToastrModule } from 'ngx-toastr';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { AngularDraggableModule } from 'angular2-draggable';
import { CodemirrorModule } from '@ctrl/ngx-codemirror';
import { NgxDaterangepickerMd } from './gui-helpers/daterangepicker';

import { AppComponent } from './app.component';
import { routing } from './app.routing';
import { AuthGuard } from './auth.guard';

import { HomeComponent } from './home/home.component';
import { HeaderComponent, DialogInfo } from './header/header.component';
import { IframeComponent } from './iframe/iframe.component';
import { ViewComponent } from './view/view.component';
import { LogsViewComponent } from './logs-view/logs-view.component';
import { SidenavComponent } from './sidenav/sidenav.component';
import { EditorComponent, DialogLinkProperty } from './editor/editor.component';
import { LayoutPropertyComponent, DialogMenuItem, DialogHeaderItem } from './editor/layout-property/layout-property.component';
import { PluginsComponent } from './editor/plugins/plugins.component';
import { AppSettingsComponent } from './editor/app-settings/app-settings.component';
import { SetupComponent } from './editor/setup/setup.component';
import { ChartConfigComponent, DialogChartLine } from './editor/chart-config/chart-config.component';
import { GraphConfigComponent, DialogGraphSource } from './editor/graph-config/graph-config.component';
import { CardConfigComponent } from './editor/card-config/card-config.component';
import { AlarmViewComponent } from './alarms/alarm-view/alarm-view.component';
import { AlarmListComponent } from './alarms/alarm-list/alarm-list.component';
import { AlarmPropertyComponent } from './alarms/alarm-property/alarm-property.component';
import { NotificationListComponent } from './notifications/notification-list/notification-list.component';
import { NotificationPropertyComponent } from './notifications/notification-property/notification-property.component';
import { ScriptListComponent } from './scripts/script-list/script-list.component';
import { ScriptEditorComponent } from './scripts/script-editor/script-editor.component';
import { ScriptSchedulingComponent } from './scripts/script-scheduling/script-scheduling.component';
import { ScriptPermissionComponent } from './scripts/script-permission/script-permission.component';
import { TextListComponent, DialogItemText } from './text-list/text-list.component';
import { LabComponent } from './lab/lab.component';
import { DeviceComponent } from './device/device.component';
import { DevicePropertyComponent } from './device/device-property/device-property.component';
import { TagOptionsComponent } from './device/tag-options/tag-options.component';
import { TopicPropertyComponent } from './device/topic-property/topic-property.component';
import { DeviceListComponent } from './device/device-list/device-list.component';
import { DeviceMapComponent } from './device/device-map/device-map.component';
import { FuxaViewComponent } from './fuxa-view/fuxa-view.component';
import { CardsViewComponent } from './cards-view/cards-view.component';
import { TesterComponent } from './tester/tester.component';
import { TesterService } from './tester/tester.service';
import { UserService } from './_services/user.service';
import { SettingsService } from './_services/settings.service';
import { PluginService } from './_services/plugin.service';
import { AuthService } from './_services/auth.service';
import { DiagnoseService } from './_services/diagnose.service';
import { ScriptService } from './_services/script.service';
import { ResourcesService } from './_services/resources.service';
import { ResWebApiService } from './_services/rcgi/reswebapi.service';
import { ResDemoService } from './_services/rcgi/resdemo.service';
import { ResClientService } from './_services/rcgi/resclient.service';
import { ProjectService } from './_services/project.service';
import { HmiService } from './_services/hmi.service';
import { AppService } from './_services/app.service';
import { TutorialComponent } from './help/tutorial/tutorial.component';
import { WindowRef } from './_helpers/windowref';
import { Utils, EnumToArrayPipe, EscapeHtmlPipe } from './_helpers/utils';
import { Calc } from './_helpers/calc';
import { Define } from './_helpers/define';
import { Dictionary } from './_helpers/dictionary';
import { NgxFabButtonComponent } from './gui-helpers/fab-button/ngx-fab-button.component';
import { NgxFabItemButtonComponent } from './gui-helpers/fab-button/ngx-fab-item-button.component';
import { TreetableComponent } from './gui-helpers/treetable/treetable.component';
import { ConfirmDialogComponent } from './gui-helpers/confirm-dialog/confirm-dialog.component';
import { SelOptionsComponent } from './gui-helpers/sel-options/sel-options.component';
import { NgxSwitchComponent } from './gui-helpers/ngx-switch/ngx-switch.component';
import { EditNameComponent } from './gui-helpers/edit-name/edit-name.component';
import { DaterangeDialogComponent } from './gui-helpers/daterange-dialog/daterange-dialog.component';
import { BitmaskComponent } from './gui-helpers/bitmask/bitmask.component';
import { RangeNumberComponent } from './gui-helpers/range-number/range-number.component';
import { LibImagesComponent } from './resources/lib-images/lib-images.component';

import { DialogDraggableDirective } from './_directives/dialog-draggable.directive';
import { ModalPositionCache } from './_directives/modal-position.cache';
import { DraggableDirective } from './_directives/ngx-draggable.directive';
import { NumberOnlyDirective, NumberOrNullOnlyDirective } from './_directives/number.directive';
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
import { HtmlIframeComponent } from './gauges/controls/html-iframe/html-iframe.component';
import { HtmlBagComponent } from './gauges/controls/html-bag/html-bag.component';
import { HtmlTableComponent } from './gauges/controls/html-table/html-table.component';
import { HtmlSwitchComponent } from './gauges/controls/html-switch/html-switch.component';
import { GaugeProgressComponent } from './gauges/controls/gauge-progress/gauge-progress.component';
import { GaugeSemaphoreComponent } from './gauges/controls/gauge-semaphore/gauge-semaphore.component';
import { UsersComponent } from './users/users.component';
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
import { GraphBarComponent } from './gauges/controls/html-graph/graph-bar/graph-bar.component';
import { GraphPieComponent } from './gauges/controls/html-graph/graph-pie/graph-pie.component';
import { GraphPropertyComponent } from './gauges/controls/html-graph/graph-property/graph-property.component';
import { GraphBaseComponent } from './gauges/controls/html-graph/graph-base/graph-base.component';
import { NgChartsModule } from 'ng2-charts';
import { IframePropertyComponent } from './gauges/controls/html-iframe/iframe-property/iframe-property.component';
import { TablePropertyComponent } from './gauges/controls/html-table/table-property/table-property.component';
import { TableCustomizerComponent, DialogTableCell } from './gauges/controls/html-table/table-customizer/table-customizer.component';
import { DataTableComponent } from './gauges/controls/html-table/data-table/data-table.component';
import { ReportListComponent } from './reports/report-list/report-list.component';
import { ReportEditorComponent } from './reports/report-editor/report-editor.component';
import { DataConverterService } from './_services/data-converter.service';
import { ReportItemTextComponent } from './reports/report-editor/report-item-text/report-item-text.component';
import { ReportItemTableComponent } from './reports/report-editor/report-item-table/report-item-table.component';
import { CommandService } from './_services/command.service';
import { ReportItemAlarmsComponent } from './reports/report-editor/report-item-alarms/report-item-alarms.component';
import { ReportItemChartComponent } from './reports/report-editor/report-item-chart/report-item-chart.component';
import { ScriptModeComponent } from './scripts/script-mode/script-mode.component';
import { DeviceWebapiPropertyDialogComponent } from './device/device-map/device-webapi-property-dialog/device-webapi-property-dialog.component';
import { SvgSelectorComponent } from './editor/svg-selector/svg-selector.component';
import { FrameworkModule } from './framework/framework.module';
import { StopInputPropagationDirective } from './_directives/stop-input-propagation.directive';
import { HeartbeatService } from './_services/heartbeat.service';
import { RcgiService } from './_services/rcgi/rcgi.service';
import { ToastNotifierService } from './_services/toast-notifier.service';
import { MyFileService } from './_services/my-file.service';
import { TagsIdsConfigComponent } from './editor/tags-ids-config/tags-ids-config.component';
import { MAT_LEGACY_TOOLTIP_DEFAULT_OPTIONS as MAT_TOOLTIP_DEFAULT_OPTIONS, MatLegacyTooltipDefaultOptions as MatTooltipDefaultOptions } from '@angular/material/legacy-tooltip';
import { HtmlImageComponent } from './gauges/controls/html-image/html-image.component';
import { NgxSchedulerComponent } from './gui-helpers/ngx-scheduler/ngx-scheduler.component';
import { FlexDeviceTagComponent } from './gauges/gauge-property/flex-device-tag/flex-device-tag.component';
import { PanelComponent } from './gauges/controls/panel/panel.component';
import { PanelPropertyComponent } from './gauges/controls/panel/panel-property/panel-property.component';
import { UserEditComponent } from './users/user-edit/user-edit.component';
import { FuxaViewDialogComponent } from './fuxa-view/fuxa-view-dialog/fuxa-view-dialog.component';
import { DeviceTagSelectionComponent } from './device/device-tag-selection/device-tag-selection.component';
import { WebcamPlayerComponent } from './gui-helpers/webcam-player/webcam-player.component';
import { WebcamPlayerDialogComponent } from './gui-helpers/webcam-player/webcam-player-dialog/webcam-player-dialog.component';
import { ScriptEditorParamComponent } from './scripts/script-editor/script-editor-param/script-editor-param.component';
import { TagPropertyEditS7Component } from './device/tag-property/tag-property-edit-s7/tag-property-edit-s7.component';
import { TagPropertyEditServerComponent } from './device/tag-property/tag-property-edit-server/tag-property-edit-server.component';
import { TagPropertyEditModbusComponent } from './device/tag-property/tag-property-edit-modbus/tag-property-edit-modbus.component';
import { TagPropertyEditInternalComponent } from './device/tag-property/tag-property-edit-internal/tag-property-edit-internal.component';
import { TagPropertyEditOpcuaComponent } from './device/tag-property/tag-property-edit-opcua/tag-property-edit-opcua.component';
import { TagPropertyEditBacnetComponent } from './device/tag-property/tag-property-edit-bacnet/tag-property-edit-bacnet.component';
import { TagPropertyEditWebapiComponent } from './device/tag-property/tag-property-edit-webapi/tag-property-edit-webapi.component';
import { TagPropertyEditEthernetipComponent } from './device/tag-property/tag-property-edit-ethernetip/tag-property-edit-ethernetip.component';
import { ViewPropertyComponent } from './editor/view-property/view-property.component';
import { ResizeDirective } from './_directives/resize.directive';
import { EditorViewsListComponent } from './editor/editor-views-list/editor-views-list.component';

export function createTranslateLoader(http: HttpClient) {
    return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

export const myCustomTooltipDefaults: MatTooltipDefaultOptions = {
    showDelay: 1750,
    hideDelay: 1000,
    touchendHideDelay: 1000,
};

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
        DeviceTagSelectionComponent,
        TagPropertyEditS7Component,
        TagPropertyEditServerComponent,
        TagPropertyEditModbusComponent,
        TagPropertyEditInternalComponent,
        TagPropertyEditOpcuaComponent,
        TagPropertyEditBacnetComponent,
        TagPropertyEditWebapiComponent,
        TagPropertyEditEthernetipComponent,
        TagOptionsComponent,
        TopicPropertyComponent,
        DevicePropertyComponent,
        DeviceWebapiPropertyDialogComponent,
        LayoutPropertyComponent,
        TagsIdsConfigComponent,
        PluginsComponent,
        AppSettingsComponent,
        SetupComponent,
        DialogMenuItem,
        DialogHeaderItem,
        DeviceListComponent,
        DeviceMapComponent,
        FuxaViewComponent,
        FuxaViewDialogComponent,
        ViewPropertyComponent,
        DialogLinkProperty,
        EditNameComponent,
        ConfirmDialogComponent,
        DialogInfo,
        DaterangeDialogComponent,
        GaugeBaseComponent,
        HtmlInputComponent,
        HtmlButtonComponent,
        HtmlSelectComponent,
        HtmlChartComponent,
        HtmlGraphComponent,
        HtmlIframeComponent,
        HtmlImageComponent,
        HtmlBagComponent,
        GaugeProgressComponent,
        GaugeSemaphoreComponent,
        GaugePropertyComponent,
        DialogGaugePermission,
        SvgSelectorComponent,
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
        FlexDeviceTagComponent,
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
        StopInputPropagationDirective,
        NumberOrNullOnlyDirective,
        NgxFabButtonComponent,
        NgxFabItemButtonComponent,
        TreetableComponent,
        BitmaskComponent,
        SelOptionsComponent,
        LazyForDirective,
        NgxSwitchComponent,
        ChartConfigComponent,
        GraphConfigComponent,
        CardConfigComponent,
        AlarmListComponent,
        AlarmViewComponent,
        AlarmPropertyComponent,
        NotificationListComponent,
        NotificationPropertyComponent,
        ScriptListComponent,
        ScriptEditorComponent,
        ScriptSchedulingComponent,
        ScriptPermissionComponent,
        ScriptModeComponent,
        ReportListComponent,
        ReportEditorComponent,
        ScriptEditorParamComponent,
        TextListComponent,
        LogsViewComponent,
        NgxGaugeComponent,
        NgxNouisliderComponent,
        NgxSchedulerComponent,
        DialogChartLine,
        DialogGraphSource,
        UsersComponent,
        UserEditComponent,
        LoginComponent,
        DialogUserInfo,
        ViewComponent,
        DialogItemText,
        NgxUplotComponent,
        ChartUplotComponent,
        CardsViewComponent,
        GraphBarComponent,
        GraphPieComponent,
        GraphPropertyComponent,
        GraphBaseComponent,
        IframePropertyComponent,
        TablePropertyComponent,
        TableCustomizerComponent,
        DialogTableCell,
        DataTableComponent,
        RangeNumberComponent,
        LibImagesComponent,
        ReportItemTextComponent,
        ReportItemTableComponent,
        ReportItemAlarmsComponent,
        ReportItemChartComponent,
        PanelComponent,
        PanelPropertyComponent,
        WebcamPlayerComponent,
        WebcamPlayerDialogComponent,
        ResizeDirective,
        EditorViewsListComponent
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
        AngularDraggableModule,
        MatSelectSearchModule,
        ToastrModule.forRoot({
            timeOut: 3000,
            positionClass: 'toast-bottom-right',
            preventDuplicates: false
        }),
        TranslateModule.forRoot({
            loader: {
                provide: TranslateLoader,
                useFactory: createTranslateLoader,
                deps: [HttpClient]
            }
        }),
        GridsterModule,
        NgChartsModule,
        CodemirrorModule,
        NgxDaterangepickerMd.forRoot(),
        FrameworkModule
    ],
    providers: [
        // providersResourceService,
        ResClientService,
        ResWebApiService,
        ResDemoService,
        HmiService,
        RcgiService,
        AppService,
        ProjectService,
        UserService,
        DiagnoseService,
        CommandService,
        HeartbeatService,
        DataConverterService,
        ScriptService,
        ResourcesService,
        PluginService,
        SettingsService,
        TesterService,
        httpInterceptorProviders,
        AuthService,
        GaugesManager,
        WindowRef,
        Utils,
        Calc,
        HtmlSwitchComponent,
        PipeComponent,
        SliderComponent,
        HtmlTableComponent,
        Dictionary,
        ModalPositionCache,
        Define,
        AuthGuard,
        ToastNotifierService,
        MyFileService,
        {provide: MAT_TOOLTIP_DEFAULT_OPTIONS, useValue: myCustomTooltipDefaults}
    ],
    bootstrap: [AppComponent]
})
export class AppModule { }
