/* eslint-disable @angular-eslint/component-class-suffix */
/* eslint-disable @angular-eslint/component-selector */
import { Component, Inject, OnInit, AfterViewInit, OnDestroy, ViewChild, ChangeDetectorRef, ElementRef } from '@angular/core';
import { MatLegacyDialog as MatDialog, MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';
import { combineLatest, interval, merge, Observable, of, Subject, Subscription, timer } from 'rxjs';
import { MatSidenav } from '@angular/material/sidenav';
import { ActivatedRoute, Router } from '@angular/router';

import { SidenavComponent } from '../sidenav/sidenav.component';
import { FuxaViewComponent } from '../fuxa-view/fuxa-view.component';
import { CardsViewComponent } from '../cards-view/cards-view.component';

import { HmiService, ScriptOpenCard, ScriptSetView } from '../_services/hmi.service';
import { ProjectService } from '../_services/project.service';
import { AuthService } from '../_services/auth.service';
import { GaugesManager } from '../gauges/gauges.component';
import { Hmi, View, ViewType, NaviModeType, NotificationModeType, ZoomModeType, HeaderSettings, LinkType, HeaderItem, Variable, GaugeStatus, GaugeSettings, GaugeEventType, LoginOverlayColorType, GaugeEvent } from '../_models/hmi';
import { LoginComponent } from '../login/login.component';
import { AlarmViewComponent } from '../alarms/alarm-view/alarm-view.component';
import { Utils } from '../_helpers/utils';
import { GridOptions } from '../cards-view/cards-view.component';
import { AlarmStatus, AlarmActionsType } from '../_models/alarm';

import { GridsterConfig } from 'angular-gridster2';

import panzoom from 'panzoom';
import { filter, map, startWith, switchMap, takeUntil } from 'rxjs/operators';
import { HtmlButtonComponent } from '../gauges/controls/html-button/html-button.component';
import { User } from '../_models/user';
import { UserInfo } from '../users/user-edit/user-edit.component';
import { Intervals } from '../_helpers/intervals';
import { Script, ScriptMode } from '../_models/script';
import { ScriptService } from '../_services/script.service';
// declare var panzoom: any;

import { ToastrService } from 'ngx-toastr';
import { LanguageService, LanguageConfiguration } from '../_services/language.service';
import { Language } from '../_models/language';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {

    @ViewChild('sidenav', { static: false }) sidenav: SidenavComponent;
    @ViewChild('matsidenav', { static: false }) matsidenav: MatSidenav;
    @ViewChild('fuxaview', { static: false }) fuxaview: FuxaViewComponent;
    @ViewChild('cardsview', { static: false }) cardsview: CardsViewComponent;
    @ViewChild('alarmsview', { static: false }) alarmsview: AlarmViewComponent;
    @ViewChild('container', { static: false }) container: ElementRef;
    @ViewChild('header', { static: false }) header: ElementRef;

    iframes: IiFrame[] = [];
    isLoading = true;
    homeView: View = new View();
    hmi: Hmi = new Hmi();
    showSidenav = 'over';
    homeLink = '';
    showHomeLink = false;
    securityEnabled = false;
    backgroudColor = 'unset';
    title = '';
    alarms = { show: false, count: 0, mode: '' };
    infos = { show: false, count: 0, mode: '' };
    headerButtonMode = NotificationModeType;
    layoutHeader = new HeaderSettings();
    showNavigation = true;
    viewAsAlarms = LinkType.alarms;
    alarmPanelWidth = '100%';
    serverErrorBanner$: Observable<boolean>;
    cardViewType = ViewType.cards;
    mapsViewType = ViewType.maps;
    gridOptions = <GridsterConfig>new GridOptions();
    intervalsScript = new Intervals();
    currentDateTime: Date = new Date();
    private headerItemsMap = new Map<string, HeaderItem[]>();
    private subscriptionLoad: Subscription;
    private subscriptionAlarmsStatus: Subscription;
    private subscriptiongoTo: Subscription;
    private subscriptionOpen: Subscription;
    private destroy$ = new Subject<void>();
    loggedUser$: Observable<User>;
    language$: Observable<LanguageConfiguration>;

    constructor(private projectService: ProjectService,
        private changeDetector: ChangeDetectorRef,
        public dialog: MatDialog,
        private router: Router,
        private route: ActivatedRoute,
        private hmiService: HmiService,
        private toastr: ToastrService,
        private scriptService: ScriptService,
        private languageService: LanguageService,
        private authService: AuthService,
        public gaugesManager: GaugesManager) {
        this.gridOptions.draggable = { enabled: false };
        this.gridOptions.resizable = { enabled: false };
    }

    ngOnInit() {
        try {
            this.subscriptionLoad = this.projectService.onLoadHmi.subscribe(() => {
                if (this.projectService.getHmi()) {
                    this.loadHmi();
                    this.initScheduledScripts();
                    this.checkDateTimeTimer();
                }
            }, error => {
                console.error(`Error loadHMI: ${error}`);
            });
            this.subscriptionAlarmsStatus = this.hmiService.onAlarmsStatus.subscribe(event => {
                this.setAlarmsStatus(event);
            });
            this.subscriptiongoTo = this.hmiService.onGoTo.subscribe((viewToGo: ScriptSetView) => {
                this.onGoToPage(this.projectService.getViewId(viewToGo.viewName), viewToGo.force);
            });
            this.subscriptionOpen = this.hmiService.onOpen.subscribe((viewToOpen: ScriptOpenCard) => {
                this.fuxaview.onOpenCard(null, null, this.projectService.getViewId(viewToOpen.viewName), viewToOpen.options);
            });

            this.serverErrorBanner$ = combineLatest([
                this.hmiService.onServerConnection$,
                this.authService.currentUser$
            ]).pipe(
                switchMap(([connectionStatus, userProfile]) =>
                    merge(
                        of(false),
                        timer(20000).pipe(map(() => (this.securityEnabled && !userProfile) ? false : true)),
                    ).pipe (
                        startWith(false),
                    )
                ),
                takeUntil(this.destroy$)
            );

            this.language$ = this.languageService.languageConfig$;
            this.loggedUser$ = this.authService.currentUser$;

            this.gaugesManager.onchange.pipe(
                takeUntil(this.destroy$),
                filter(varTag => this.headerItemsMap.has(varTag.id))
            ).subscribe(varTag => {
                this.processValueInHeaderItem(varTag);
            });
        } catch (err) {
            console.error(err);
        }
    }

    ngAfterViewInit() {
        try {
            // TODO
            setTimeout(() => {
                this.projectService.notifyToLoadHmi();
            }, 0);
            this.hmiService.askAlarmsStatus();
            this.changeDetector.detectChanges();
        }
        catch (err) {
            console.error(err);
        }
    }

    ngOnDestroy() {
        try {
            if (this.subscriptionLoad) {
                this.subscriptionLoad.unsubscribe();
            }
            if (this.subscriptionAlarmsStatus) {
                this.subscriptionAlarmsStatus.unsubscribe();
            }
            if (this.subscriptionOpen) {
                this.subscriptionOpen.unsubscribe();
            }
            if (this.subscriptiongoTo) {
                this.subscriptiongoTo.unsubscribe();
            }
            this.destroy$.next(null);
            this.destroy$.complete();
            this.intervalsScript.clearIntervals();
        } catch (e) {
        }
    }

    private checkDateTimeTimer(): void {
        if (this.hmi.layout?.header?.dateTimeDisplay) {
            interval(1000).pipe(
                takeUntil(this.destroy$)
            ).subscribe(() => {
                this.currentDateTime = new Date();
            });
        }
    }

    private initScheduledScripts() {
        this.intervalsScript.clearIntervals();
        this.projectService.getScripts()?.forEach((script: Script) => {
            if (script.mode === ScriptMode.CLIENT && script.scheduling?.interval > 0) {
                this.intervalsScript.addInterval(
                    script.scheduling.interval * 1000,
                    this.scriptService.evalScript,
                    script,
                    this.scriptService
                );
            }
        });
    }

    onGoToPage(viewId: string, force: boolean = false) {
        if (viewId === this.viewAsAlarms) {
            this.onAlarmsShowMode('expand');
            this.checkToCloseSideNav();
        } else if (!this.homeView || viewId !== this.homeView?.id || force || this.fuxaview?.view?.id !== viewId) {
            const view = this.hmi.views.find(x => x.id === viewId);
            this.setIframe();
            this.showHomeLink = false;
            this.changeDetector.detectChanges();
            if (view) {
                this.homeView = view;
                this.changeDetector.detectChanges();
                this.setBackground();
                if (this.homeView.type !== this.cardViewType && this.homeView.type !== this.mapsViewType) {
                    this.checkZoom();
                    this.fuxaview.hmi.layout = this.hmi.layout;
                    this.fuxaview.loadHmi(this.homeView);
                } else if (this.cardsview) {
                    this.cardsview.reload();
                }
            }
            this.onAlarmsShowMode('close');
            this.checkToCloseSideNav();
        }
    }

    onGoToLink(event: string) {
        if (event.indexOf('://') >= 0 || event[0] == '/') {
            this.showHomeLink = true;
            this.changeDetector.detectChanges();
            this.setIframe(event);

        } else {
            this.router.navigate([event]).then(data => {
            }).catch(err => {
                console.error('Route ' + event + '  not found, redirection stopped with no error raised');
                // try iframe link
            });
        }
        this.checkToCloseSideNav();
    }

    setIframe(link: string = null) {
        this.homeView = null;
        let currentLink: string;
        this.iframes.forEach(iframe => {
            if (!iframe.hide) {
                currentLink = iframe.link;
            }
            iframe.hide = true;
        });
        if (link) {
            let iframe = this.iframes.find(f => f.link === link);
            if (!iframe) {
                this.iframes.push({ link: link, hide: false });
            } else {
                iframe.hide = false;
                if (currentLink === link) {     // to refresh
                    iframe.link = '';
                    this.changeDetector.detectChanges();
                    iframe.link = link;
                }
            }
        }
    }

    checkToCloseSideNav() {
        if (this.hmi.layout) {
            let nvoid = NaviModeType[this.hmi.layout.navigation.mode];
            if (nvoid !== NaviModeType.fix && this.matsidenav) {
                this.matsidenav.close();
            }
        }
    }

    onLogin() {
        let cuser = this.authService.getUser();
        if (cuser) {
            let dialogRef = this.dialog.open(DialogUserInfo, {
                id: 'myuserinfo',
                // minWidth: '250px',
                position: { top: '50px', right: '15px' },
                backdropClass: 'user-info',
                data: cuser
            });
            dialogRef.afterClosed().subscribe(result => {
                if (result) {
                    this.authService.signOut();
                    this.projectService.reload();
                }
            });
        } else {
            let dialogConfig = {
                data: {},
                disableClose: true,
                autoFocus: false,
                ...(this.hmi.layout.loginoverlaycolor && this.hmi.layout.loginoverlaycolor !== LoginOverlayColorType.none) && {
                    backdropClass: this.hmi.layout.loginoverlaycolor === LoginOverlayColorType.black ? 'backdrop-black' : 'backdrop-white'
                }
            };

            let dialogRef = this.dialog.open(LoginComponent, dialogConfig);
            dialogRef.afterClosed().subscribe(result => {
                const userInfo = new UserInfo(this.authService.getUser()?.info);
                if (userInfo.start) {
                    this.onGoToPage(userInfo.start);
                }
            });
        }
    }

    askValue() {
        this.hmiService.askDeviceValues();
    }

    askStatus() {
        this.hmiService.askDeviceStatus();
    }

    isLoggedIn() {
        return (this.authService.getUser()) ? true : false;
    }

    onAlarmsShowMode(mode: string) {
        if (Utils.getEnumKey(NaviModeType, NaviModeType.fix) === this.hmi.layout.navigation.mode && this.matsidenav) {
            this.alarmPanelWidth = `calc(100% - ${this.matsidenav._getWidth()}px)`;
        }
        let ele = document.getElementById('alarms-panel');
        if (mode === 'expand') {
            ele.classList.add('is-full-active');
            // ele.classList.remove('is-active');
            this.alarmsview.startAskAlarmsValues();
        } else if (mode === 'collapse') {
            ele.classList.add('is-active');
            ele.classList.remove('is-full-active');
            this.alarmsview.startAskAlarmsValues();
        } else {
            // ele.classList.toggle("is-active");
            ele.classList.remove('is-active');
            ele.classList.remove('is-full-active');
        }
    }

    onSetLanguage(language: Language) {
        this.languageService.setCurrentLanguage(language);
        window.location.reload();
    }

    private processValueInHeaderItem(varTag: Variable) {
        this.headerItemsMap.get(varTag.id)?.forEach(item => {
            if (item.status.variablesValue[varTag.id] !== varTag.value) {
                HtmlButtonComponent.processValue(
                    <GaugeSettings>{ property: item.property },
                    item.element ?? Utils.findElementByIdRecursive(this.header.nativeElement, item.id),
                    varTag,
                    item.status,
                    item.type === 'label'
                );
            }
            item.status.variablesValue[varTag.id] = varTag.value;
        });
    }

    private goTo(destination: string) {
        this.router.navigate([destination]);//, this.ID]);
    }

    private loadHmi() {
        let hmi = this.projectService.getHmi();
        if (hmi) {
            this.hmi = hmi;
        }
        if (this.hmi && this.hmi.views && this.hmi.views.length > 0) {
            let viewToShow = null;
            if (this.hmi.layout?.start) {
                viewToShow = this.hmi.views.find(x => x.id === this.hmi.layout.start);
            }
            if (!viewToShow) {
                viewToShow = this.hmi.views[0];
            }
            let startView = this.hmi.views.find(x => x.name === this.route.snapshot.queryParamMap.get('viewName')?.trim());
            if (startView) {
                viewToShow = startView;
            }
            this.homeView = viewToShow;
            this.setBackground();
            // check sidenav
            this.showSidenav = null;
            if (this.hmi.layout) {
                if (Utils.Boolify(this.hmi.layout.hidenavigation)) {
                    this.showNavigation = false;
                }
                let nvoid = NaviModeType[this.hmi.layout.navigation.mode];
                if (this.hmi.layout && nvoid !== NaviModeType.void) {
                    if (nvoid === NaviModeType.over) {
                        this.showSidenav = 'over';
                    } else if (nvoid === NaviModeType.fix) {
                        this.showSidenav = 'side';
                        if (this.matsidenav) {this.matsidenav.open();}
                    } else if (nvoid === NaviModeType.push) {
                        this.showSidenav = 'push';
                    }
                    this.sidenav.setLayout(this.hmi.layout);
                }
                if (this.hmi.layout.header) {
                    this.title = this.hmi.layout.header.title;
                    if (this.hmi.layout.header.alarms) {
                        this.alarms.mode = this.hmi.layout.header.alarms;
                    }
                    if (this.hmi.layout.header.infos) {
                        this.infos.mode = this.hmi.layout.header.infos;
                    }
                    this.checkHeaderButton();
                    this.layoutHeader = Utils.clone(this.hmi.layout.header);
                    this.changeDetector.detectChanges();
                    this.loadHeaderItems();
                }
                this.checkZoom();
            }
        }
        if (this.homeView && this.fuxaview) {
            this.fuxaview.hmi.layout = this.hmi.layout;
            this.fuxaview.loadHmi(this.homeView);
        }
        this.isLoading = false;
        this.securityEnabled = this.projectService.isSecurityEnabled();
        if (this.securityEnabled && !this.isLoggedIn() && this.hmi.layout.loginonstart) {
            this.onLogin();
        }
    }

    private checkZoom() {
        if (this.hmi.layout?.zoom && ZoomModeType[this.hmi.layout.zoom] === ZoomModeType.enabled) {
            setTimeout(() => {
                let element: HTMLElement = document.querySelector('#home');
                if (element && panzoom) {
                    panzoom(element, {
                        bounds: true,
                        boundsPadding: 0.05,
                    });
                }
                this.container.nativeElement.style.overflow = 'hidden';
            }, 1000);
        }
    }

    private loadHeaderItems() {
        this.headerItemsMap.clear();
        if (!this.showNavigation) {
            return;
        }
        this.layoutHeader.items?.forEach(item => {
            item.status = item.status ?? new GaugeStatus();
            item.status.onlyChange = true;
            item.status.variablesValue = {};
            item.element = Utils.findElementByIdRecursive(this.header.nativeElement, item.id);
            (item as any).text = this.languageService.getTranslation(item.property?.text) ?? item.property?.text;
            const signalsIds = HtmlButtonComponent.getSignals(item.property);
            signalsIds.forEach(sigId => {
                if (!this.headerItemsMap.has(sigId)) {
                    this.headerItemsMap.set(sigId, []);
                }
                this.headerItemsMap.get(sigId).push(item);
            });
            const settingsProperty = new GaugeSettings(null, HtmlButtonComponent.TypeTag);
            settingsProperty.property = item.property;
            this.onBindMouseEvents(item.element, settingsProperty);
        });
        this.hmiService.homeTagsSubscribe(Array.from(this.headerItemsMap.keys()));
    }

    private onBindMouseEvents(element: HTMLElement, ga: GaugeSettings) {
        if (element) {
            let clickEvents = this.gaugesManager.getBindMouseEvent(ga, GaugeEventType.click);
            if (clickEvents?.length > 0) {
                element.onclick = (ev: MouseEvent) => {
                    this.handleMouseEvent(ga, ev, clickEvents);
                };
                element.ontouchstart = (ev) => {
                    this.handleMouseEvent(ga, ev, clickEvents);
                };

            }
            let mouseDownEvents = this.gaugesManager.getBindMouseEvent(ga, GaugeEventType.mousedown);
            if (mouseDownEvents?.length > 0) {
                element.onmousedown = (ev) => {
                    this.handleMouseEvent(ga, ev, mouseDownEvents);
                };
            }
            let mouseUpEvents = this.gaugesManager.getBindMouseEvent(ga, GaugeEventType.mouseup);
            if (mouseUpEvents?.length > 0) {
                element.onmouseup = (ev) => {
                    this.handleMouseEvent(ga, ev, mouseUpEvents);
                };
            }
        }
    }

    private handleMouseEvent(
        ga: GaugeSettings,
        ev: Event,
        events: GaugeEvent[]
    ) {
        let fuxaviewRef = this.fuxaview ?? this.cardsview.getFuxaView(0);
        if (!fuxaviewRef) {
            return;
        }
        const homeEvents = events.filter(event => event.action === 'onpage');
        homeEvents.forEach(event => {
            this.onGoToPage(event.actparam);
        });
        const fuxaViewEvents = events.filter(event => event.action !== 'onpage');
        if (fuxaViewEvents.length > 0) {
            fuxaviewRef.runEvents(fuxaviewRef, ga, ev, events);
        }
    }

    private setBackground() {
        if (this.homeView?.profile) {
            this.backgroudColor = this.homeView.profile.bkcolor;
        }
    }

    private checkHeaderButton() {
        let fix = <NotificationModeType>Object.keys(NotificationModeType)[Object.values(NotificationModeType).indexOf(NotificationModeType.fix)];
        let float = <NotificationModeType>Object.keys(NotificationModeType)[Object.values(NotificationModeType).indexOf(NotificationModeType.float)];
        if (this.alarms.mode === fix || (this.alarms.mode === float && this.alarms.count > 0)) {
            this.alarms.show = true;
        }
        else {
            this.alarms.show = false;
        }
        if (this.infos.mode === fix || (this.infos.mode === float && this.infos.count > 0)) {
            this.infos.show = true;
        } else {
            this.infos.show = false;
        }
    }

    private setAlarmsStatus(status: AlarmStatus) {
        if (status) {
            this.alarms.count = status.highhigh + status.high + status.low;
            this.infos.count = status.info;
            this.checkHeaderButton();
            this.checkActions(status.actions);
        }
    }

    private checkActions(actions: any[]) {
        if (actions) {
            actions.forEach(act => {
                if (act.type === Utils.getEnumKey(AlarmActionsType, AlarmActionsType.popup)) {
                    this.fuxaview.openDialog(null, act.params, {});
                } else if (act.type === Utils.getEnumKey(AlarmActionsType, AlarmActionsType.setView)) {
                    this.onGoToPage(act.params);
                } else if (act.type === Utils.getEnumKey(AlarmActionsType, AlarmActionsType.toastMessage)) {
                    var msg = act.params;
                    // Check if the toast with the same message is already being displayed
                    const resetOnDuplicate = true;  // Reset the duplicate toast
                    // Use findDuplicate to check if the toast already exists
                    const duplicateToast = this.toastr.findDuplicate('', msg, resetOnDuplicate, false);
                    if (!duplicateToast) {
                        const toastType = act.options?.type ?? 'info';
                        // If no duplicate exists, show the toast
                        this.toastr[toastType](msg, '', {
                            timeOut: 3000,
                            closeButton: true,
                            disableTimeOut: true
                        });
                    }
                }
            });
        }
    }
}

export interface IiFrame {
    link: string;
    hide: boolean;
}

@Component({
    selector: 'user-info',
    templateUrl: 'userinfo.dialog.html',
})
export class DialogUserInfo {
    constructor(
        public dialogRef: MatDialogRef<DialogUserInfo>,
        @Inject(MAT_DIALOG_DATA) public data: any) { }

    onOkClick(): void {
        this.dialogRef.close(true);
    }
}
