import { Component, Input, OnInit, OnDestroy, OnChanges, SimpleChanges, ViewChild, ElementRef, ChangeDetectorRef, ViewEncapsulation, AfterViewInit, NgZone } from '@angular/core';
import { fromEvent, Subject, take, takeUntil } from 'rxjs';
import { HmiService } from '../../../../_services/hmi.service';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { AuthService } from '../../../../_services/auth.service';
import { Utils } from '../../../../_helpers/utils';
import { TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-scheduler',
    templateUrl: './scheduler.component.html',
    styleUrls: ['./scheduler.component.scss'],
    encapsulation: ViewEncapsulation.None
})
export class SchedulerComponent implements OnInit, OnDestroy, OnChanges, AfterViewInit {
    @ViewChild('schedulerContainer', { static: true }) schedulerContainer: ElementRef;
    @ViewChild('deviceScrollContainer', { static: false }) deviceScrollContainer: ElementRef;
    @ViewChild('overviewScrollContainer', { static: false }) overviewScrollContainer: ElementRef;
    @Input() property: any;
    @Input() isEditor: boolean = false;
    @Input() id: string;

    private destroy$ = new Subject<void>();

    dayLabelsShort: string[] = [];
    dayLabelsLong: string[] = [];
    monthLabelsShort: string[] = [];
    monthLabelsLong: string[] = [];
    periods: Array<'am' | 'pm'> = ['am', 'pm'];
    unnamedDevice = '-';

    static getSignals(pro: any): string[] {
        let res: string[] = [];
        if (pro && pro.devices) {
            pro.devices.forEach(device => {
                if (device.variableId) {
                    res.push(device.variableId);
                }
            });
        }
        return res;
    }

    schedules: { [deviceName: string]: any[] } = {};
    selectedDevice: string = 'OVERVIEW';
    selectedDeviceIndex: number = -1;
    deviceList: any[] = [];
    hoveredDevice: string = null;

    activeStates: Map<string, boolean> = new Map();

    // Get time format from property (12hr or 24hr)
    get timeFormat(): '12hr' | '24hr' {
        return this.property?.timeFormat || '12hr'; // Default to 12hr
    }

    // Filter properties
    showFilterOptions: boolean = false;
    filterOptions = {
        showDisabled: true,
        showActive: true
    };

    // Scrolling detection
    needsScrolling: boolean = false;
    overviewNeedsScrolling: boolean = false;

    // Settings properties
    showSettingsOptions: boolean = false;

    // Event mode tracking
    hasEventModeSchedules: boolean = false;
    eventStartTimes: Map<string, number> = new Map();
    remainingTimes: Map<string, number> = new Map();

    // Form properties
    isEditMode: boolean = false;
    showAddForm: boolean = false;
    editingIndex: number = -1;
    eventMode: boolean = false;
    formTimer: any = {
        startTime: '08:00',
        endTime: '18:00',
        event: true,
        days: [false, true, true, true, true, true, true],
        months: Array(12).fill(false),
        daysOfMonth: Array(31).fill(false),
        monthMode: false,
        allDay: false,
        disabled: false,
        deviceName: '',
        recurring: true,
        eventMode: false,
        durationHours: 0,
        durationMinutes: 1,
        durationSeconds: 0
    };
    // Ensure all schedules have months/daysOfMonth arrays
    ensureScheduleArrays(schedule: any) {
        if (!schedule.months) schedule.months = Array(12).fill(false);
        if (!schedule.daysOfMonth) schedule.daysOfMonth = Array(31).fill(false);
        if (!schedule.days) schedule.days = Array(7).fill(false);
    }
    daysOfMonth = Array.from({ length: 31 }, (_, i) => i + 1);
    toggleMonth(index: number) {
        if (!this.formTimer.months) this.formTimer.months = Array(12).fill(false);
        this.formTimer.months[index] = !this.formTimer.months[index];
    }
    toggleDayOfMonth(index: number) {
        if (!this.formTimer.daysOfMonth) this.formTimer.daysOfMonth = Array(31).fill(false);
        this.formTimer.daysOfMonth[index] = !this.formTimer.daysOfMonth[index];
    }
    onAllDayChange() {
        if (this.formTimer.allDay) {
            // Set to full 24 hours
            this.formTimer.startTime = '00:00';
            this.formTimer.endTime = '23:59';
        } else {
            // Reset to default working hours
            this.formTimer.startTime = '08:00';
            this.formTimer.endTime = '18:00';
        }
    }
    showCalendarPopup(schedule?: any) {
        if (!schedule) return;

        this.ensureScheduleArrays(schedule);

        // Create calendar details message using same grid layout as form
        let message = '<div class="calendar-popup-content">';

        // Months section
        message += `<label>${this.translateService.instant('scheduler.months-active')}:</label>`;
        message += '<div class="months-row">';
        for (let i = 0; i < this.monthLabelsShort.length; i++) {
            const isActive = schedule.months && schedule.months[i];
            message += `<div class="day-btn month-btn${isActive ? ' active' : ''}">`;
            message += this.monthLabelsShort[i];
            message += '</div>';
        }
        message += '</div>';

        // Days of month section
        message += `<label>${this.translateService.instant('scheduler.days-of-month')}:</label>`;
        message += '<div class="days-of-month-calendar">';
        for (let i = 0; i < 31; i++) {
            const isActive = schedule.daysOfMonth && schedule.daysOfMonth[i];
            message += `<div class="day-btn day-of-month-btn${isActive ? ' active' : ''}">`;
            message += (i + 1);
            message += '</div>';
        }
        message += '</div>';

        message += '</div>';

        // Show calendar dialog
        this.confirmDialogData = {
            title: this.translateService.instant('scheduler.monthly-schedule-details'),
            message: message,
            confirmText: this.translateService.instant('general.close'),
            icon: 'calendar_month',
            showCancel: false,
            action: () => this.closeConfirmDialog()
        };
        this.showConfirmDialog = true;
    }

    // UI properties
    // Required for external interface
    tagValues: { [tagId: string]: any } = {};

    // TrackBy functions for ngFor performance
    trackByDeviceGroup(index: number, item: any): string {
        return item.deviceName;
    }

    trackBySchedule(index: number, item: any): string {
        return `${item.deviceName}-${item.startTime}-${index}`;
    }

    constructor(
        private hmiService: HmiService,
        private cdr: ChangeDetectorRef,
        private dialog: MatDialog,
        private authService: AuthService,
        private translateService: TranslateService,
        private ngZone: NgZone
    ) { }

    ngOnInit() {

        this.initializeDevices();
        this.applyCustomColors();
        this.loadSchedulesFromServer();
        this.initI18nLists();

        // Listen for scheduler updates from server
        this.hmiService.onSchedulerUpdated.pipe(
            takeUntil(this.destroy$)
        ).subscribe((message) => {
            if (message.id === this.id) {
                this.loadSchedulesFromServer();
            }
        });

        // Listen for scheduler event active state changes
        this.hmiService.onSchedulerEventActive.pipe(
            takeUntil(this.destroy$)
        ).subscribe((message) => {
            if (message.schedulerId === this.id) {

                const eventId = message.eventData?.id;
                if (!eventId) {
                    return;
                }
                const stateKey = `${message.deviceName}_${eventId}`;
                this.activeStates.set(stateKey, message.active);

                // For event mode: track start time and duration
                if (message.active && message.eventData?.eventMode && message.eventData?.duration) {
                    this.eventStartTimes.set(stateKey, Date.now());
                    const duration = message.remainingTime !== undefined ? message.remainingTime : message.eventData.duration;
                    this.remainingTimes.set(stateKey, duration);
                } else if (!message.active) {
                    this.eventStartTimes.delete(stateKey);
                    this.remainingTimes.delete(stateKey);
                }

                // Use NgZone.run() to force Angular change detection and UI update
                this.ngZone.run(() => {
                    // Force multiple change detection cycles to ensure animation updates
                    this.cdr.detectChanges();
                    setTimeout(() => this.cdr.detectChanges(), 0);
                    setTimeout(() => this.cdr.detectChanges(), 100);
                });
            }
        });

        // Listen for remaining time updates from server
        this.hmiService.onSchedulerRemainingTime.pipe(
            takeUntil(this.destroy$)
        ).subscribe((message) => {
            if (message.schedulerId === this.id) {
                const eventId = message.eventId;
                if (!eventId) {
                    return;
                }
                const stateKey = `${message.deviceName}_${eventId}`;
                this.remainingTimes.set(stateKey, message.remaining);
                this.cdr.detectChanges();
            }
        });

        // MASTER CONTROL: Start immediately
        if (!this.isEditor) {
            // Start master control as soon as possible
            setTimeout(() => {
                this.loadDeviceStatesForDisplay();
            }, 100);
        }

        // Force initial change detection
        setTimeout(() => {
            this.cdr.detectChanges();
        }, 100);

        // Initialize event-driven scheduler
        if (!this.isEditor) {
            this.initializeEventDrivenScheduler();
        }


        fromEvent<MouseEvent>(document, 'click').pipe(
            takeUntil(this.destroy$)
        ).subscribe(this.onDocumentClick.bind(this));

    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes.property) {
            if (changes.property.previousValue && changes.property.currentValue) {
                this.migrateSchedulesOnPropertyChange(
                    changes.property.previousValue.devices || [],
                    changes.property.currentValue.devices || []
                );
            }

            this.initializeDevices();
            this.applyCustomColors();

            // we need to save to server so the actions are persisted and executed server-side
            if (!this.isEditor) {
                this.saveSchedulesToServer(true);
            }
        }
    }

    ngAfterViewInit() {
        setTimeout(() => this.checkScrollingState(), 0);
    }

    checkScrollingState() {
        setTimeout(() => {
            let changed = false;

            // Check device scroll container
            if (this.deviceScrollContainer && this.deviceScrollContainer.nativeElement) {
                const element = this.deviceScrollContainer.nativeElement;
                const wasScrolling = this.needsScrolling;
                this.needsScrolling = element.scrollHeight > element.clientHeight;
                if (wasScrolling !== this.needsScrolling) {
                    changed = true;
                }
            }

            // Check overview scroll container
            if (this.overviewScrollContainer && this.overviewScrollContainer.nativeElement) {
                const element = this.overviewScrollContainer.nativeElement;
                const wasOverviewScrolling = this.overviewNeedsScrolling;
                this.overviewNeedsScrolling = element.scrollHeight > element.clientHeight;
                if (wasOverviewScrolling !== this.overviewNeedsScrolling) {
                    changed = true;
                }
            }

            if (changed) {
                this.cdr.detectChanges();
            }
        }, 100);
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();

        if (this.transitionWatcher) {
            cancelAnimationFrame(this.transitionWatcher);
        }

        Object.values(this.tagWriteTimeout).forEach(timeout => {
            if (timeout) clearTimeout(timeout);
        });
        this.tagWriteTimeout = {};
        this.recentTagWrites.clear();

    }

    initializeDevices() {
        if (this.property && this.property.devices && this.property.devices.length > 0) {
            this.deviceList = this.property.devices.map(device => ({
                name: device.name || device.label || this.unnamedDevice,
                label: device.label || device.name || this.unnamedDevice,
                variableId: device.variableId || '',
                permission: device.permission,
                permissionRoles: device.permissionRoles
            }));

        } else {
            this.deviceList = [];
        }

        // Set initial view
        if (this.deviceList.length > 1) {
            this.selectedDevice = 'OVERVIEW';
            this.selectedDeviceIndex = -1;
        } else if (this.deviceList.length === 1) {
            this.selectedDevice = this.deviceList[0].name;
            this.selectedDeviceIndex = 0;
        } else {
            this.selectedDevice = 'OVERVIEW';
            this.selectedDeviceIndex = -1;
        }
    }

    // ==================== PERMISSION CHECKING METHODS ====================

    /**
     * Check if user has master scheduler permission
     * @returns { show: boolean, enabled: boolean }
     */
    checkMasterPermission(): { show: boolean, enabled: boolean } {
        if (this.isEditor) {
            // In editor mode, always allow full access
            return { show: true, enabled: true };
        }

        const permission = this.authService.checkPermission(this.property);
        return permission || { show: true, enabled: true };
    }

    /**
     * Check if user has permission for a specific device
     * @param deviceName - The name of the device to check
     * @returns { show: boolean, enabled: boolean }
     */
    checkDevicePermission(deviceName: string): { show: boolean, enabled: boolean } {
        if (this.isEditor) {
            return { show: true, enabled: true };
        }

        const device = this.deviceList.find(d => d.name === deviceName);
        if (!device) {
            return { show: false, enabled: false };
        }

        if (!device.permission && !device.permissionRoles) {
            return this.checkMasterPermission();
        }

        const permission = this.authService.checkPermission(device);
        return permission || { show: true, enabled: true };
    }

    /**
     * Check if user can modify the scheduler (add/remove devices, change settings)
     * @returns boolean
     */
    canModifyScheduler(): boolean {
        const permission = this.checkMasterPermission();
        return permission.enabled;
    }

    /**
     * Check if user can see a specific device
     * @param deviceName - The name of the device
     * @returns boolean
     */
    canSeeDevice(deviceName: string): boolean {
        const permission = this.checkDevicePermission(deviceName);
        return permission.show;
    }

    /**
     * Check if user can modify a specific device's events
     * @param deviceName - The name of the device
     * @returns boolean
     */
    canModifyDevice(deviceName: string): boolean {
        const device = this.deviceList.find(d => d.name === deviceName);
        if (!device) {
            return false;
        }

        const masterPermission = this.checkMasterPermission();

        // If device has no explicit permission set, inherit master permission
        if (!device.permission && !device.permissionRoles) {
            return masterPermission.enabled;
        }

        // If device has explicit permission, require BOTH master AND device enabled
        const devicePermission = this.checkDevicePermission(deviceName);
        return masterPermission.enabled && devicePermission.enabled;
    }

    /**
     * Get list of devices that user has permission to modify (for form dropdown)
     * @returns Array of devices user can modify
     */
    getModifiableDevices(): any[] {
        return this.deviceList.filter(device => this.canModifyDevice(device.name));
    }

    /**
     * CRITICAL: Migrate schedules when device names or variableIds change in properties
     * This ensures data consistency when users update device configurations
     */
    migrateSchedulesOnPropertyChange(oldDevices: any[], newDevices: any[]) {
        if (!oldDevices || !newDevices || oldDevices.length === 0) {
            return;
        }

        let changesMade = false;
        const newSchedules: { [deviceName: string]: any[] } = {};

        // Create a map of old device data by index for comparison
        const oldDeviceMap = new Map<number, { name: string, variableId: string }>();
        oldDevices.forEach((device, index) => {
            oldDeviceMap.set(index, {
                name: device.name || device.label || this.unnamedDevice,
                variableId: device.variableId || ''
            });
        });

        // Process each new device and migrate/update schedules
        newDevices.forEach((newDevice, index) => {
            const newDeviceName = newDevice.name || newDevice.label || this.unnamedDevice;
            const newVariableId = newDevice.variableId || '';

            // Get corresponding old device by index (same position in list)
            const oldDevice = oldDeviceMap.get(index);

            if (oldDevice) {
                const oldDeviceName = oldDevice.name;
                const oldVariableId = oldDevice.variableId;

                // Check if device name changed
                const nameChanged = oldDeviceName !== newDeviceName;
                const tagChanged = oldVariableId !== newVariableId;

                if (nameChanged || tagChanged) {
                    changesMade = true;
                }

                // Get schedules from old device name
                const deviceSchedules = this.schedules[oldDeviceName] || [];

                if (deviceSchedules.length > 0) {
                    // Update all schedules for this device
                    const updatedSchedules = deviceSchedules.map(schedule => ({
                        ...schedule,
                        deviceName: newDeviceName,
                        variableId: newVariableId
                    }));

                    // Store under new device name
                    newSchedules[newDeviceName] = updatedSchedules;

                    if (nameChanged) {
                    }
                    if (tagChanged) {
                    }
                } else {
                    // No schedules for this device, but preserve empty array if it exists
                    if (this.schedules[oldDeviceName] !== undefined) {
                        newSchedules[newDeviceName] = [];
                    }
                }
            } else {
                // New device added (no corresponding old device)
                // Check if schedules exist under the new name already
                if (this.schedules[newDeviceName]) {
                    newSchedules[newDeviceName] = this.schedules[newDeviceName];
                }
            }
        });

        // Handle orphaned schedules (devices that were removed)
        Object.keys(this.schedules).forEach(oldDeviceName => {
            // Check if this device name still exists in new devices
            const stillExists = newDevices.some(device =>
                (device.name || device.label || this.unnamedDevice) === oldDeviceName
            );

            if (!stillExists && !newSchedules[oldDeviceName]) {
                changesMade = true;
                // Don't copy to newSchedules - effectively deletes them
            }
        });

        // Apply migrated schedules
        if (changesMade) {
            this.schedules = newSchedules;
            // Save to server to persist changes in database - force update to ensure changes are saved
            this.saveSchedulesToServer(true);
        }
    }

    /**
     * Sync loaded schedules with current device list to ensure variableIds are current
     * This handles cases where properties were changed but schedules weren't migrated
     */
    syncSchedulesWithDeviceList() {
        if (!this.deviceList || this.deviceList.length === 0) {
            return;
        }

        let changesMade = false;

        // Create a map of device name -> current variableId
        const deviceMap = new Map<string, string>();
        this.deviceList.forEach(device => {
            deviceMap.set(device.name, device.variableId);
        });

        // Update variableIds in all schedules to match current device configuration
        Object.keys(this.schedules).forEach(deviceName => {
            const currentVariableId = deviceMap.get(deviceName);

            if (currentVariableId) {
                // Device exists in current configuration
                this.schedules[deviceName].forEach(schedule => {
                    if (schedule.variableId !== currentVariableId) {
                        schedule.variableId = currentVariableId;
                        changesMade = true;
                    }
                });
            } else {
                // Device no longer exists in configuration - orphaned schedules
            }
        });

        // Save if any changes were made
        if (changesMade) {
            this.saveSchedulesToServer(true);
        }
    }

    loadSchedulesFromServer() {
        if (!this.id) return;

        this.hmiService.askSchedulerData(this.id).pipe(
            take(1)
        ).subscribe({
            next: (data) => {
                if (data && data.schedules) {
                    // Convert old format to device name-based format if needed
                    if (Array.isArray(data.schedules)) {
                        this.convertToDeviceNameFormat(data.schedules);
                    } else {
                        // Already in device name format
                        this.schedules = data.schedules ? { ...data.schedules } : {};
                    }
                } else {
                    this.schedules = {};
                }

                // Ensure all events have unique IDs for proper tracking
                for (const deviceName in this.schedules) {
                    if (this.schedules[deviceName]) {
                        this.schedules[deviceName].forEach(event => {
                            if (!event.id) {
                                event.id = Utils.getShortGUID('s_');
                            }
                            // Ensure schedule has proper arrays for month/day support
                            this.ensureScheduleArrays(event);
                        });
                    }
                }

                this.syncSchedulesWithDeviceList();
                this.initializeActiveStates();
                this.cdr.detectChanges();

                // This ensures server has deviceActions even without client intervention
                if (this.property?.deviceActions && !data?.settings?.deviceActions) {
                    this.saveSchedulesToServer(true);
                } else if (!this.property?.deviceActions && data?.settings?.deviceActions) {

                }

                if (!this.isEditor) {
                    this.loadDeviceStatesForDisplay();
                }
            },
            error: (error) => {
                if (error.status === 404) {
                } else {
                    console.error('Error loading scheduler data:', error);
                }
                this.schedules = {};
                this.cdr.detectChanges();

                if (!this.isEditor) {
                    this.loadDeviceStatesForDisplay();
                }
            }
        });
    }

    convertToDeviceNameFormat(oldSchedules: any[]) {
        this.schedules = {};
        oldSchedules.forEach(deviceSchedule => {
            if (deviceSchedule.schedules) {
                deviceSchedule.schedules.forEach(schedule => {
                    const deviceOutput = schedule.output !== undefined ? schedule.output : deviceSchedule.deviceIndex;
                    const deviceName = this.getDeviceNameByIndex(deviceOutput);
                    if (deviceName) {
                        if (!this.schedules[deviceName]) {
                            this.schedules[deviceName] = [];
                        }
                        this.schedules[deviceName].push({
                            ...schedule,
                            deviceName: deviceName
                        });
                    }
                });
            }
        });
        this.saveSchedulesToServer(true);
    }

    getDeviceNameByIndex(index: number): string {
        if (this.deviceList && this.deviceList[index]) {
            return this.deviceList[index].name;
        }
        return '';
    }

    selectDevice(deviceIndexOrName: number | string) {
        if (typeof deviceIndexOrName === 'string') {
            // Handle string selection from custom dropdown
            this.selectedDevice = deviceIndexOrName;
            this.isDropdownOpen = false;
            this.hoveredDevice = null;
            this.onDeviceSelectionChange(deviceIndexOrName);
            return;
        }

        // Handle number selection (existing logic)
        const deviceIndex = deviceIndexOrName;
        if (deviceIndex === -1) {
            this.selectedDevice = 'OVERVIEW';
            this.selectedDeviceIndex = -1;
        } else if (this.deviceList[deviceIndex]) {
            this.selectedDevice = this.deviceList[deviceIndex].name;
            this.selectedDeviceIndex = deviceIndex;
        } else {
            this.selectedDevice = 'OVERVIEW';
            this.selectedDeviceIndex = -1;
        }

        this.cdr.detectChanges();
        this.checkScrollingState();
    }

    onDeviceSelectionChange(selectedValue: string) {
        if (selectedValue === 'OVERVIEW') {
            this.selectedDevice = 'OVERVIEW';
            this.selectedDeviceIndex = -1;
        } else {
            // Find the device index by name
            const deviceIndex = this.deviceList.findIndex(device => device.name === selectedValue);
            if (deviceIndex !== -1) {
                this.selectedDevice = selectedValue;
                this.selectedDeviceIndex = deviceIndex;
            } else {
                this.selectedDevice = 'OVERVIEW';
                this.selectedDeviceIndex = -1;
            }
        }

        this.cdr.detectChanges();
        this.checkScrollingState();
    }

    getFilteredOverviewSchedules(): any[] {
        const deviceGroups = [];

        Object.keys(this.schedules).forEach(deviceName => {
            const schedules = this.schedules[deviceName] || [];
            if (schedules.length === 0) return;

            // Filter schedules based on filter options
            const filteredSchedules = schedules.filter(schedule => {
                const isCurrentlyActive = this.isScheduleActive(schedule);

                // If schedule is currently running, only show it if showActive is true
                if (isCurrentlyActive) {
                    return this.filterOptions.showActive;
                }
                // If schedule is currently off, only show it if showDisabled is true
                else {
                    return this.filterOptions.showDisabled;
                }
            });

            // Separate Timer Mode and Event Mode schedules
            const timerModeSchedules = filteredSchedules.filter(s => !s.eventMode);
            const eventModeSchedules = filteredSchedules.filter(s => s.eventMode === true);

            // Only include device group if it has schedules after filtering
            if (filteredSchedules.length > 0) {
                deviceGroups.push({
                    deviceName: deviceName,
                    timerModeSchedules: timerModeSchedules,
                    eventModeSchedules: eventModeSchedules,
                    allSchedules: filteredSchedules
                });
            }
        });

        return deviceGroups.sort((a, b) => a.deviceName.localeCompare(b.deviceName));
    }

    toggleFilter() {
        this.showFilterOptions = !this.showFilterOptions;
        this.cdr.detectChanges();
    }

    toggleSettings() {
        this.showSettingsOptions = !this.showSettingsOptions;
        this.cdr.detectChanges();
    }

    getSelectStyles(): { [key: string]: string } {
        return {
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.5)',
            color: this.property?.secondaryTextColor || '#ffffff',
            borderRadius: '3px',
            padding: '4px 8px',
            height: '20px',
            display: 'flex',
            alignItems: 'center'
        };
    }

    getOptionStyle(isSelected: boolean): { [key: string]: string } {
        if (isSelected) {
            return {
                color: this.property?.secondaryTextColor || '#ffffff',
                backgroundColor: this.property?.accentColor || '#2196f3'
            };
        } else {
            return {
                color: this.property?.textColor || '#333333',
                backgroundColor: this.property?.backgroundColor || '#ffffff'
            };
        }
    }



    getDeviceSchedules(): any[] {
        if (this.selectedDevice === 'OVERVIEW') {
            // Return all schedules for overview
            const allSchedules = [];
            Object.keys(this.schedules).forEach(deviceName => {
                const deviceSchedules = this.schedules[deviceName] || [];
                allSchedules.push(...deviceSchedules);
            });
            return [...allSchedules];
        }

        // Get schedules for specific device
        const deviceSchedules = this.schedules[this.selectedDevice] || [];
        return [...deviceSchedules];
    }

    getDeviceTimerModeSchedules(): any[] {
        return this.getDeviceSchedules().filter(s => !s.eventMode);
    }

    getDeviceEventModeSchedules(): any[] {
        return this.getDeviceSchedules().filter(s => s.eventMode === true);
    }

    hasDeviceTimerModeSchedules(): boolean {
        return this.getDeviceTimerModeSchedules().length > 0;
    }

    hasDeviceEventModeSchedules(): boolean {
        return this.getDeviceEventModeSchedules().length > 0;
    }

    saveSchedulesToServer(forceUpdate: boolean = false) {
        if (!this.id) return;

        if (this.isEditor && !forceUpdate) {
            return;
        }

        const dataToSave = {
            schedules: this.schedules,
            settings: {
                eventMode: this.eventMode,
                devices: this.deviceList,
                deviceActions: this.property?.deviceActions || []
            }
        };

        this.hmiService.setSchedulerData(this.id, dataToSave).pipe(
            take(1)
        ).subscribe({
            next: (response) => {
                // Server will handle device control
                this.refreshTagSubscriptions();
            },
            error: (error) => {
                console.error('Error saving schedules:', error);
            }
        });
    }

    toggleAddView() {
        // Check permission before allowing add
        const deviceName = this.selectedDevice === 'OVERVIEW' ? (this.deviceList[0]?.name || '') : this.selectedDevice;
        if (!this.canModifyDevice(deviceName)) {
            return;
        }

        this.isEditMode = !this.isEditMode;
        this.showAddForm = this.isEditMode;
        if (this.isEditMode) {
            this.resetForm();
            this.editingIndex = -1;
        }
        this.cdr.detectChanges();
    }

    resetForm() {
        this.formTimer = {
            startTime: '08:00',
            endTime: '18:00',
            event: true,
            days: [false, true, true, true, true, true, true],
            months: Array(12).fill(false),
            daysOfMonth: Array(31).fill(false),
            monthMode: false,
            allDay: false,
            disabled: false,
            deviceName: this.selectedDevice === 'OVERVIEW' ? (this.deviceList[0]?.name || '') : this.selectedDevice,
            recurring: true,
            eventMode: false,
            durationHours: 0,
            durationMinutes: 1,
            durationSeconds: 0
        };
        this.cdr.detectChanges();
    }

    addOrUpdateSchedule() {
        if (!this.formTimer.startTime || !this.formTimer.deviceName) return;

        const deviceName = this.formTimer.deviceName;
        const device = this.deviceList.find(d => d.name === deviceName);
        if (!device) return;

        // Check permission before allowing save
        if (!this.canModifyDevice(deviceName)) {
            return;
        }

        const newSchedule: any = {
            startTime: this.formTimer.startTime,
            days: this.formTimer.days,
            months: this.formTimer.months,
            daysOfMonth: this.formTimer.daysOfMonth,
            monthMode: this.formTimer.monthMode,
            allDay: this.formTimer.allDay,
            disabled: this.formTimer.disabled,
            deviceName: deviceName,
            variableId: device.variableId,
            recurring: this.formTimer.recurring !== undefined ? this.formTimer.recurring : true,
            eventMode: this.formTimer.eventMode || false
        };

        // Add mode-specific fields
        if (this.formTimer.eventMode) {
            // Event Mode: duration in seconds
            newSchedule.duration = (this.formTimer.durationHours * 3600) +
                (this.formTimer.durationMinutes * 60) +
                this.formTimer.durationSeconds;
        } else {
            // Timer Mode: end time
            newSchedule.endTime = this.formTimer.endTime;
        }

        // Show confirmation dialog with schedule details
        const scheduleDetails = this.formatScheduleDetails(newSchedule);
        this.confirmDialogData = {
            title: this.editingIndex >= 0 ? this.translateService.instant('scheduler.update-schedule') : this.translateService.instant('scheduler.add-schedule'),
            message: scheduleDetails,
            confirmText: this.translateService.instant('general.confirm'),
            icon: 'event',
            action: () => this.executeSaveSchedule(newSchedule)
        };
        this.showConfirmDialog = true;
    }

    private executeSaveSchedule(newSchedule: any) {
        const deviceName = newSchedule.deviceName;

        if (!this.schedules[deviceName]) {
            this.schedules[deviceName] = [];
        }

        if (this.editingIndex >= 0) {
            const schedules = this.getDeviceSchedules();
            if (schedules[this.editingIndex]) {
                const oldSchedule = schedules[this.editingIndex];
                const oldDeviceName = oldSchedule.deviceName;

                // Preserve the ID from the old schedule
                newSchedule.id = oldSchedule.id;

                // Remove from old device if device changed
                if (oldDeviceName && oldDeviceName !== deviceName) {
                    const oldIndex = this.schedules[oldDeviceName]?.findIndex(s => s === oldSchedule);
                    if (oldIndex >= 0) {
                        this.schedules[oldDeviceName].splice(oldIndex, 1);
                    }
                }

                // Add to new device
                if (oldDeviceName === deviceName) {
                    const scheduleIndex = this.schedules[deviceName].findIndex(s => s === oldSchedule);
                    if (scheduleIndex >= 0) {
                        this.schedules[deviceName][scheduleIndex] = newSchedule;
                    }
                } else {
                    this.schedules[deviceName].push(newSchedule);
                }
            }
        } else {
            // Add new schedule - generate ID
            newSchedule.id = Utils.getShortGUID('s_');
            this.schedules[deviceName].push(newSchedule);
        }

        this.saveSchedulesToServer(true);
        this.showAddForm = false;
        this.isEditMode = false;
        this.editingIndex = -1;

        // Return to OVERVIEW mode after save
        this.selectedDevice = 'OVERVIEW';

        this.cdr.detectChanges();
        this.checkScheduleStates();
    }

    editSchedule(index: number) {
        const schedules = this.getDeviceSchedules();
        if (!schedules[index]) return;

        const schedule = schedules[index];

        // Use schedule.deviceName if available (overview mode), otherwise use selectedDevice
        const deviceName = schedule.deviceName || this.selectedDevice;

        // Check permission before allowing edit
        if (!this.canModifyDevice(deviceName)) {
            return;
        }

        // Extract duration components from total seconds if in Event Mode
        let durationHours = 0;
        let durationMinutes = 1;
        let durationSeconds = 0;

        if (schedule.eventMode && schedule.duration !== undefined) {
            const totalSeconds = schedule.duration;
            durationHours = Math.floor(totalSeconds / 3600);
            durationMinutes = Math.floor((totalSeconds % 3600) / 60);
            durationSeconds = totalSeconds % 60;
        }

        this.formTimer = {
            startTime: schedule.startTime,
            endTime: schedule.endTime || '18:00',
            event: schedule.event !== undefined ? schedule.event : true,
            days: [...(schedule.days || [false, false, false, false, false, false, false])],
            months: [...(schedule.months || new Array(12).fill(false))],
            daysOfMonth: [...(schedule.daysOfMonth || new Array(31).fill(false))],
            monthMode: schedule.monthMode || false,
            allDay: schedule.allDay || (schedule.startTime === '00:00' && schedule.endTime === '23:59'),
            disabled: schedule.disabled || false,
            deviceName: deviceName,
            recurring: schedule.recurring !== undefined ? schedule.recurring : true,
            eventMode: schedule.eventMode || false,
            durationHours: durationHours,
            durationMinutes: durationMinutes,
            durationSeconds: durationSeconds
        };

        this.editingIndex = index;
        this.showAddForm = true;
        this.isEditMode = true;
    }

    editScheduleFromOverview(schedule: any, scheduleIndex: number) {
        // Find the global index for this schedule
        const allSchedules = this.getDeviceSchedules();
        const globalIndex = allSchedules.findIndex(s =>
            s.deviceName === schedule.deviceName &&
            s.startTime === schedule.startTime &&
            s.endTime === schedule.endTime &&
            JSON.stringify(s.days) === JSON.stringify(schedule.days)
        );

        if (globalIndex >= 0) {
            this.editSchedule(globalIndex);
        }
    }

    confirmDeleteFromOverview(schedule: any, scheduleIndex: number) {
        this.confirmDialogData = {
            title: this.translateService.instant('scheduler.delete-schedule'),
            message: this.translateService.instant('scheduler.to-remove', { value: schedule.deviceName }),
            confirmText: this.translateService.instant('general.delete'),
            icon: 'warning',
            action: () => this.executeDeleteFromOverview(schedule, scheduleIndex)
        };
        this.showConfirmDialog = true;
    }

    private executeDeleteFromOverview(schedule: any, scheduleIndex: number) {
        const deviceName = schedule.deviceName;
        if (this.schedules[deviceName]) {
            const scheduleIndex = this.schedules[deviceName].findIndex(s =>
                s.startTime === schedule.startTime &&
                s.endTime === schedule.endTime &&
                JSON.stringify(s.days) === JSON.stringify(schedule.days)
            );

            if (scheduleIndex >= 0) {
                this.schedules[deviceName].splice(scheduleIndex, 1);

                this.saveSchedulesToServer(true);
                this.cdr.detectChanges();
            }
        }
    }

    deleteSchedule(index: number) {
        const schedules = this.getDeviceSchedules();
        const schedule = schedules[index];

        // Use schedule.deviceName if available (overview mode), otherwise use selectedDevice
        const deviceName = schedule.deviceName || this.selectedDevice;

        // Check permission before allowing delete
        if (!this.canModifyDevice(deviceName)) {
            return;
        }

        this.confirmDialogData = {
            title: this.translateService.instant('scheduler.delete-schedule'),
            message: this.translateService.instant('scheduler.to-remove', { value: schedule.deviceName }),
            confirmText: this.translateService.instant('general.delete'),
            icon: 'warning',
            action: () => this.executeDeleteSchedule(index)
        };
        this.showConfirmDialog = true;
    }

    private executeDeleteSchedule(index: number) {
        const schedules = this.getDeviceSchedules();
        if (schedules[index]) {
            const scheduleToDelete = schedules[index];
            const deviceName = scheduleToDelete.deviceName || this.selectedDevice;

            if (this.schedules[deviceName]) {
                const scheduleIndex = this.schedules[deviceName].findIndex(s => s === scheduleToDelete);
                if (scheduleIndex >= 0) {
                    this.schedules[deviceName].splice(scheduleIndex, 1);

                    this.saveSchedulesToServer(true);
                    this.cdr.detectChanges();
                    this.checkScrollingState();
                }
            }
        }
    }

    toggleSchedule(index: number) {
        const schedules = this.getDeviceSchedules();
        if (schedules[index]) {
            const scheduleToToggle = schedules[index];
            // Use schedule.deviceName if available, otherwise use selectedDevice
            const deviceName = scheduleToToggle.deviceName || this.selectedDevice;

            // Check permission before allowing toggle
            if (!this.canModifyDevice(deviceName)) {
                return;
            }

            if (this.schedules[deviceName]) {
                const scheduleIndex = this.schedules[deviceName].findIndex(s => s === scheduleToToggle);
                if (scheduleIndex >= 0) {
                    this.schedules[deviceName][scheduleIndex].disabled = !this.schedules[deviceName][scheduleIndex].disabled;

                    // Re-evaluate device state after enabling/disabling schedule
                    const hasActiveSchedules = this.schedules[deviceName].some(s => !s.disabled);

                    if (!hasActiveSchedules) {
                        // No active schedules left, reset device to OFF
                        this.resetDeviceTag(deviceName);
                    } else {
                        // Has active schedules, re-evaluate current state
                        this.checkScheduleStates();
                    }

                    this.saveSchedulesToServer(true);
                    this.cdr.detectChanges();
                    this.checkScheduleStates();
                }
            }
        }
    }

    // Track previous states
    private deviceStates: { [deviceName: string]: boolean } = {};
    private signalSubscription: any = null;
    private scheduledTags: Set<string> = new Set();
    private lastScheduleCheck: number = 0;
    private transitionWatcher: number = 0;
    private recentTagWrites: Set<string> = new Set();
    private tagWriteTimeout: { [key: string]: any } = {};

    initializeEventDrivenScheduler() {

        this.loadDeviceStatesForDisplay();
        this.subscribeToScheduledTags();
        this.startTransitionWatcher();
    }

    private subscribeToScheduledTags() {
        this.scheduledTags.clear();

        this.deviceList.forEach(device => {
            if (device.variableId && this.schedules[device.name]?.length > 0) {
                this.scheduledTags.add(device.variableId);
            }
        });

        if (this.scheduledTags.size > 0) {
            const tagIds = Array.from(this.scheduledTags);

            this.hmiService.viewsTagsSubscribe(tagIds, true);

            this.signalSubscription = this.hmiService.onVariableChanged.pipe(
                takeUntil(this.destroy$)
            ).subscribe(
                (signal) => this.handleSignalChange(signal)
            );
        }
    }

    private handleSignalChange(signal: any) {
        if (!this.scheduledTags.has(signal.id)) {
            return;
        }

        this.tagValues[signal.id] = signal.value;

        const now = Date.now();
        if (now - this.lastScheduleCheck < 500) {
            this.cdr.detectChanges();
            return;
        }
        this.lastScheduleCheck = now;

        const tagWriteKey = `write_${signal.id}`;
        if (this.recentTagWrites && this.recentTagWrites.has(tagWriteKey)) {
            this.cdr.detectChanges();
            return;
        }

        this.enforceSchedulerControl();
        this.cdr.detectChanges();
    }

    private startTransitionWatcher() {
        let lastCheck = 0;
        const CHECK_INTERVAL = 2000;

        const checkTransitions = (timestamp: number) => {
            if (timestamp - lastCheck >= CHECK_INTERVAL) {
                this.checkEventTransitions();
                this.checkScheduleStates();
                this.enforceSchedulerControl();
                lastCheck = timestamp;
            }

            this.transitionWatcher = requestAnimationFrame(checkTransitions);
        };

        this.transitionWatcher = requestAnimationFrame(checkTransitions);
    }

    private refreshTagSubscriptions() {

        if (this.signalSubscription) {
            this.signalSubscription.unsubscribe();
        }

        this.subscribeToScheduledTags();
    }


    loadDeviceStatesForDisplay() {

        this.deviceList.forEach(device => {
            const deviceName = device.name;
            this.deviceStates[deviceName] = false;
        });

        this.cdr.detectChanges();
    }

    checkEventTransitions() {
        if (this.isEditor) return;

    }

    checkScheduleStates() {
        if (this.isEditor) return;

    }

    writeDeviceTag(deviceName: string, value: any) {
    }

    enforceSchedulerControl() {
        if (this.isEditor) return;

    }

    private isValueTrue(value: any): boolean {
        // Helper method to check if a value represents "true" in various formats
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'number') {
            return value !== 0;
        }
        if (typeof value === 'string') {
            const strValue = value.toLowerCase();
            return strValue === 'true' || strValue === '1';
        }
        return Boolean(value);
    }

    resetDeviceTag(deviceName: string) {
    }



    deleteSchedulerData() {
        // Delete this scheduler's data from database completely
        // WARNING: This permanently deletes all schedule data for this scheduler!
        if (this.id) {
            this.hmiService.deleteSchedulerData(this.id).pipe(
                take(1)
            ).subscribe({
                next: (result) => { },
                error: (error) => {
                    console.error('Error deleting scheduler data:', error);
                }
            });
        }
    }

    // Method called when scheduler component is actually deleted from editor canvas
    onCanvasDelete() {
        if (this.isEditor) {
            this.deleteSchedulerData();
        }
    }

    destroy() {
        try {
            this.ngOnDestroy();
        } catch (e) {
            console.error('Error during scheduler destroy:', e);
        }
    }

    startAddFromOverview() {
        // Start adding a schedule from overview - select first device by default
        if (this.deviceList.length > 0) {
            this.selectedDevice = this.deviceList[0].name;
            this.selectedDeviceIndex = 0;
            this.toggleAddView();
        }
    }

    isTimeInRange(currentTime: string, startTime: string, endTime: string): boolean {
        const current = this.timeToMinutes(currentTime);
        const start = this.timeToMinutes(startTime);
        const end = this.timeToMinutes(endTime);

        if (start <= end) {
            return current >= start && current <= end;
        } else {
            // Overnight range
            return current >= start || current <= end;
        }
    }

    timeToMinutes(time: string): number {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    }

    getScheduleIndex(schedule: any): number {
        if (!schedule.deviceName || !this.schedules[schedule.deviceName]) {
            return -1;
        }
        return this.schedules[schedule.deviceName].findIndex(s => s === schedule);
    }

    initializeActiveStates() {
        Object.keys(this.schedules).forEach(deviceName => {
            const deviceSchedules = this.schedules[deviceName] || [];
            deviceSchedules.forEach((schedule, index) => {
                // CRITICAL: Use event.id for stateKey (stable), NOT index
                const eventId = schedule.id;
                if (!eventId) {
                    return;
                }
                const stateKey = `${deviceName}_${eventId}`;

                // Event Mode events are ONLY controlled by server emits (START/END callbacks)
                if (schedule.eventMode === true) {
                    return;
                }

                // Use time-based calculation for Timer Mode events only
                const now = new Date();
                const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
                const currentDay = now.getDay();

                if (!schedule.disabled && schedule.days[currentDay]) {
                    const isActive = this.isTimeInRange(currentTime, schedule.startTime, schedule.endTime || '23:59');
                    this.activeStates.set(stateKey, isActive);
                } else {
                    this.activeStates.set(stateKey, false);
                }
            });
        });
    }

    isScheduleActive(schedule: any): boolean {
        if (schedule.disabled) return false;

        // ALWAYS use server-provided active state for both Timer Mode and Event Mode
        const eventId = schedule.id;
        if (!eventId) {
            return false;
        }
        const stateKey = `${schedule.deviceName}_${eventId}`;
        if (this.activeStates.has(stateKey)) {
            const serverState = this.activeStates.get(stateKey);
            return serverState;
        }

        return false;
    }

    formatTime(time: string): string {
        if (!time) return '';

        if (this.timeFormat === '12hr') {
            const [hourStr, minute] = time.split(':');
            let hour = parseInt(hourStr);
            const period = hour >= 12 ? 'pm' : 'am';

            // Convert to 12-hour format
            if (hour === 0) hour = 12;
            else if (hour > 12) hour -= 12;

            return `${hour}:${minute}<span class="time-period">${period}</span>`;
        }

        return time; // 24hr format
    }

    calculateDuration(schedule: any): string {
        if (schedule.event || !schedule.endTime) {
            return 'Event';
        }

        const start = this.timeToMinutes(schedule.startTime);
        let end = this.timeToMinutes(schedule.endTime);

        if (end < start) {
            end += 24 * 60; // Next day
        }

        const durationMinutes = end - start;
        const hours = Math.floor(durationMinutes / 60);
        const minutes = durationMinutes % 60;

        return `${hours}h ${minutes}m`;
    }

    getDeviceName(deviceName: string): string {
        return deviceName;
    }

    isDeviceActive(deviceName: string): boolean {
        // Find the device's tag ID
        const device = this.deviceList.find(d => d.name === deviceName);
        if (!device || !device.variableId) {
            // Fallback to schedule-based check if tag not found
            const deviceSchedules = this.schedules[deviceName] || [];
            return deviceSchedules.some(s => !s.disabled);
        }

        // Return actual tag value if available, otherwise fallback to schedule check
        if (device.variableId in this.tagValues) {
            return !!this.tagValues[device.variableId];
        }

        // Fallback: check if any schedule exists and is not disabled
        const deviceSchedules = this.schedules[deviceName] || [];
        return deviceSchedules.some(s => !s.disabled);
    }

    getActiveDays(days: boolean[]): string {
        const activeDays = [];
        days.forEach((active, index) => {
            if (active) {
                activeDays.push(this.dayLabelsShort[index]);
            }
        });
        return activeDays.join(', ');
    }

    cancelForm(): void {
        this.showAddForm = false;
        this.isEditMode = false;
        this.editingIndex = -1;
    }

    toggleDay(index: number): void {
        if (index >= 0 && index < this.formTimer.days.length) {
            this.formTimer.days[index] = !this.formTimer.days[index];
            this.cdr.detectChanges();
        }
    }

    getSelectAllText(): string {
        const allSelected =
          Array.isArray(this.formTimer?.days) && this.formTimer.days.length &&
          this.formTimer.days.every(Boolean);
        return this.translateService.instant(allSelected ? 'scheduler.deselect-all' : 'scheduler.select-all');
    }

    onSelectAllDays(): void {
        const allSelected = this.formTimer.days.every(day => day);
        this.formTimer.days = this.formTimer.days.map(() => !allSelected);
    }

    applyCustomColors() {
        if (this.property && this.schedulerContainer) {
            const element = this.schedulerContainer.nativeElement;

            if (this.property.accentColor) {
                element.style.setProperty('--scheduler-accent-color', this.property.accentColor);
                // Create hover background as very light accent color
                const hoverBg = this.hexToRgba(this.property.accentColor, 0.05);
                element.style.setProperty('--scheduler-hover-bg', hoverBg);
                // Also set hover-color for menu items (light version of accent)
                const hoverColor = this.hexToRgba(this.property.accentColor, 0.20); // Increased opacity for better visibility
                element.style.setProperty('--scheduler-hover-color', hoverColor);
            } else {
                // Set default hover background if no accent color
                element.style.setProperty('--scheduler-hover-bg', 'rgba(33, 150, 243, 0.05)');
                element.style.setProperty('--scheduler-hover-color', 'rgba(33, 150, 243, 0.12)');
            }
            if (this.property.backgroundColor) {
                element.style.setProperty('--scheduler-bg-color', this.property.backgroundColor);
            }
            if (this.property.textColor) {
                element.style.setProperty('--scheduler-text-color', this.property.textColor);
            }
            if (this.property.secondaryTextColor) {
                element.style.setProperty('--scheduler-secondary-text-color', this.property.secondaryTextColor);
            }
            if (this.property.borderColor) {
                element.style.setProperty('--scheduler-border-color', this.property.borderColor);
            }
            if (this.property.hoverColor) {
                element.style.setProperty('--scheduler-hover-bg', this.property.hoverColor);
            }
            // Note: Don't override hover color here as it's already set above with the theme color
        }
    }

    private hexToRgba(hex: string, alpha: number): string {
        try {
            const originalHex = hex;
            // Remove # if present
            hex = hex.replace('#', '');

            // Handle 3-digit hex codes
            if (hex.length === 3) {
                hex = hex.split('').map(char => char + char).join('');
            }

            // Ensure we have a 6-digit hex
            if (hex.length !== 6) {
                return `rgba(33, 150, 243, ${alpha})`; // Fallback to blue
            }

            // Parse hex values using substring instead of substr (deprecated)
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);

            // Validate the parsed values
            if (isNaN(r) || isNaN(g) || isNaN(b)) {
                return `rgba(33, 150, 243, ${alpha})`; // Fallback to blue
            }

            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        } catch (error) {
            console.error('Error converting hex to rgba:', error);
            // Fallback to blue if anything goes wrong
            return `rgba(33, 150, 243, ${alpha})`;
        }
    }

    getOptionBackgroundColor(isSelected: boolean, isHovered: boolean): string {
        if (isSelected) {
            return `${this.property?.accentColor || '#2196f3'} !important`;
        } else if (isHovered) {
            const accentColor = this.property?.accentColor || '#2196f3';
            return `${this.hexToRgba(accentColor, 0.4)} !important`;
        } else {
            return `${this.property?.backgroundColor || '#ffffff'} !important`;
        }
    }

    getOptionTextColor(isSelected: boolean): string {
        return isSelected ? `${this.property?.secondaryTextColor || '#ffffff'} !important` : `${this.property?.textColor || '#333333'} !important`;
    }

    onOptionHover(deviceName: string, event: MouseEvent): void {
        this.hoveredDevice = deviceName;
        const element = event.target as HTMLElement;
        if (element && !element.classList.contains('mdc-list-item--selected')) {
            const accentColor = this.property?.accentColor || '#2196f3';
            const hoverColor = this.hexToRgba(accentColor, 0.4);
            element.style.setProperty('background-color', hoverColor, 'important');
            element.style.setProperty('color', this.property?.textColor || '#333333', 'important');
        }
    }

    onOptionLeave(event: MouseEvent): void {
        this.hoveredDevice = null;
        const element = event.target as HTMLElement;
        if (element && !element.classList.contains('mdc-list-item--selected')) {
            element.style.setProperty('background-color', this.property?.backgroundColor || '#ffffff', 'important');
            element.style.setProperty('color', this.property?.textColor || '#333333', 'important');
        }
    }

    isDropdownOpen = false;
    isFormDropdownOpen = false;
    formHoveredDevice: string | null = null;

    toggleDropdown(): void {
        if (!this.isEditMode) {
            this.isDropdownOpen = !this.isDropdownOpen;
        }
    }

    toggleFormDropdown(): void {
        this.isFormDropdownOpen = !this.isFormDropdownOpen;
    }

    selectFormDevice(deviceName: string): void {
        this.formTimer.deviceName = deviceName;
        this.isFormDropdownOpen = false;
        this.formHoveredDevice = null;
    }

    getFormSelectedDeviceLabel(): string {
        if (!this.formTimer.deviceName) {
            return this.translateService.instant('scheduler.device-selector-select-device');
        }
        const device = this.deviceList.find(d => d.name === this.formTimer.deviceName);
        return device?.label || device?.name || this.formTimer.deviceName;
    }



    getSelectedDeviceLabel(): string {
        if (this.selectedDevice === 'OVERVIEW') {
            return this.translateService.instant('scheduler.device-selector-overview');
        }
        const device = this.deviceList.find(d => d.name === this.selectedDevice);
        return device?.label || device?.name || this.translateService.instant('scheduler.device-selector-select-device');
    }

    onDocumentClick(event: Event): void {
        const target = event.target as HTMLElement;
        const headerDropdown = target.closest('.custom-select');
        const formDropdown = target.closest('.form-custom-select');
        const timePicker = target.closest('.custom-time-picker');
        const filterSection = target.closest('.filter-section');
        const settingsSection = target.closest('.settings-section');

        if (!headerDropdown && this.isDropdownOpen) {
            this.isDropdownOpen = false;
            this.hoveredDevice = null;
        }

        if (!formDropdown && this.isFormDropdownOpen) {
            this.isFormDropdownOpen = false;
            this.formHoveredDevice = null;
        }

        if (!timePicker && this.activeTimePicker) {
            this.closeTimePicker();
        }

        // Close filter dropdown when clicking outside
        if (!filterSection && this.showFilterOptions) {
            this.showFilterOptions = false;
            this.cdr.detectChanges();
        }

        // Close settings dropdown when clicking outside
        if (!settingsSection && this.showSettingsOptions) {
            this.showSettingsOptions = false;
            this.cdr.detectChanges();
        }
    }

    // Custom time picker methods
    activeTimePicker: string | null = null;
    timeDropdowns: { [key: string]: boolean } = {};
    minuteInterval: number = 1;

    // Confirmation dialog properties
    showConfirmDialog: boolean = false;
    confirmDialogData: any = null;

    openTimePicker(type: 'start' | 'end' | 'duration'): void {
        this.activeTimePicker = type;
        // Close other dropdowns
        this.isDropdownOpen = false;
        this.isFormDropdownOpen = false;

        // Scroll to selected time after dropdown renders
        setTimeout(() => {
            this.scrollToSelectedTime(type);
        }, 50);
    }

    closeTimePicker(): void {
        this.activeTimePicker = null;
    }

    getHourOptions(): string[] {
        const hours = [];
        for (let i = 1; i <= 12; i++) {
            hours.push(i.toString().padStart(2, '0'));
        }
        return hours;
    }

    getMinuteOptions(): string[] {
        const minutes = [];
        for (let i = 0; i < 60; i += this.minuteInterval) {
            minutes.push(i.toString().padStart(2, '0'));
        }
        return minutes;
    }

    setMinuteInterval(interval: number): void {
        this.minuteInterval = interval;
        // Don't close the picker, just update the options
        this.cdr.detectChanges();
    }

    scrollToSelectedTime(type: 'start' | 'end' | 'duration'): void {
        // Use setTimeout to ensure the DOM has updated
        setTimeout(() => {
            // Get the active time picker dropdown
            const activePickerSelector = `[class*="activeTimePicker"][*ngIf="activeTimePicker === '${type}'"]`;

            // Scroll hour into view within its container
            const hourContainer = document.querySelector(
                `.time-picker-dropdown .time-part:nth-child(1) .time-options`
            );
            const hourElement = document.querySelector(
                `.time-picker-dropdown .time-part:nth-child(1) .time-option.selected`
            );
            if (hourElement && hourContainer) {
                const containerRect = hourContainer.getBoundingClientRect();
                const elementRect = hourElement.getBoundingClientRect();
                const scrollOffset = elementRect.top - containerRect.top - (containerRect.height / 2) + (elementRect.height / 2);
                hourContainer.scrollTop += scrollOffset;
            }

            // Scroll minute into view within its container
            const minuteContainer = document.querySelector(
                `.time-picker-dropdown .time-part:nth-child(2) .time-options`
            );
            let minuteElement = document.querySelector(
                `.time-picker-dropdown .time-part:nth-child(2) .time-option.selected`
            );

            // If no exact match, find the closest minute option
            if (!minuteElement && minuteContainer && (type === 'start' || type === 'end')) {
                const currentMinute = parseInt(this.getTimeMinute(type));
                const minuteOptions = Array.from(minuteContainer.querySelectorAll('.time-option'));
                let closestOption = null;
                let closestDiff = Infinity;

                minuteOptions.forEach((option: Element) => {
                    const optionValue = parseInt((option as HTMLElement).textContent?.trim() || '0');
                    const diff = Math.abs(optionValue - currentMinute);
                    if (diff < closestDiff) {
                        closestDiff = diff;
                        closestOption = option;
                    }
                });

                minuteElement = closestOption;
            }

            if (minuteElement && minuteContainer) {
                const containerRect = minuteContainer.getBoundingClientRect();
                const elementRect = minuteElement.getBoundingClientRect();
                const scrollOffset = elementRect.top - containerRect.top - (containerRect.height / 2) + (elementRect.height / 2);
                minuteContainer.scrollTop += scrollOffset;
            }

            // For duration picker, also scroll seconds into view
            if (type === 'duration') {
                const secondContainer = document.querySelector(
                    `.time-picker-dropdown .time-part:nth-child(3) .time-options`
                );
                const secondElement = document.querySelector(
                    `.time-picker-dropdown .time-part:nth-child(3) .time-option.selected`
                );
                if (secondElement && secondContainer) {
                    const containerRect = secondContainer.getBoundingClientRect();
                    const elementRect = secondElement.getBoundingClientRect();
                    const scrollOffset = elementRect.top - containerRect.top - (containerRect.height / 2) + (elementRect.height / 2);
                    secondContainer.scrollTop += scrollOffset;
                }
            }
        }, 100);
    }

    // Get formatted time for input field display (follows timeFormat setting)
    getFormattedInputTime(type: 'start' | 'end'): string {
        const time = type === 'start' ? this.formTimer.startTime : this.formTimer.endTime;
        if (!time) return '';

        // If 12hr format, convert for display
        if (this.timeFormat === '12hr') {
            const [hour, minute] = time.split(':');
            const hourNum = parseInt(hour);
            const period = hourNum >= 12 ? 'pm' : 'am';
            let displayHour = hourNum % 12;
            if (displayHour === 0) displayHour = 12;
            return `${displayHour}:${minute}${period}`;
        }

        // 24hr format - return as is
        return time;
    }

    // Update time from input (handles both 12hr and 24hr formats)
    updateTimeFromInput(type: 'start' | 'end', value: string): void {
        if (!value) return;

        // Check if input includes am/pm (12hr format)
        const ampmMatch = value.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
        if (ampmMatch) {
            let hour = parseInt(ampmMatch[1]);
            const minute = ampmMatch[2];
            const period = ampmMatch[3].toLowerCase();

            // Convert to 24hr format for storage
            if (period === 'pm' && hour !== 12) hour += 12;
            if (period === 'am' && hour === 12) hour = 0;

            const time24 = `${hour.toString().padStart(2, '0')}:${minute}`;
            if (type === 'start') {
                this.formTimer.startTime = time24;
            } else {
                this.formTimer.endTime = time24;
            }
        } else {
            // Assume 24hr format
            if (type === 'start') {
                this.formTimer.startTime = value;
            } else {
                this.formTimer.endTime = value;
            }
        }
    }

    getTimeHour(type: 'start' | 'end'): string {
        const time = type === 'start' ? this.formTimer.startTime : this.formTimer.endTime;
        if (!time) return '12';
        const [hour] = time.split(':');
        const hourNum = parseInt(hour);
        if (hourNum === 0) return '12';
        if (hourNum > 12) return (hourNum - 12).toString().padStart(2, '0');
        return hourNum.toString().padStart(2, '0');
    }

    getTimeMinute(type: 'start' | 'end'): string {
        const time = type === 'start' ? this.formTimer.startTime : this.formTimer.endTime;
        if (!time) return '00';
        const [, minute] = time.split(':');
        return minute || '00';
    }

    getTimePeriod(type: 'start' | 'end'): 'am' | 'pm' {
        const time = type === 'start' ? this.formTimer.startTime : this.formTimer.endTime;
        if (!time) return 'am';
        const [hour] = time.split(':');
        const hourNum = parseInt(hour);
        return hourNum >= 12 ? 'pm' : 'am';
    }

    setTimeHour(type: 'start' | 'end', hour: string): void {
        const currentMinute = this.getTimeMinute(type);
        const currentPeriod = this.getTimePeriod(type); // 'am' | 'pm'

        let hour24 = parseInt(hour);
        if (currentPeriod === 'pm' && hour24 !== 12) hour24 += 12;
        if (currentPeriod === 'am' && hour24 === 12) hour24 = 0;

        const newTime = `${hour24.toString().padStart(2, '0')}:${currentMinute}`;
        if (type === 'start') this.formTimer.startTime = newTime;
        else this.formTimer.endTime = newTime;
    }

    setTimeMinute(type: 'start' | 'end', minute: string): void {
        const currentHour = this.getTimeHour(type);
        const currentPeriod = this.getTimePeriod(type); // 'am' | 'pm'

        let hour24 = parseInt(currentHour);
        if (currentPeriod === 'pm' && hour24 !== 12) hour24 += 12;
        if (currentPeriod === 'am' && hour24 === 12) hour24 = 0;

        const newTime = `${hour24.toString().padStart(2, '0')}:${minute}`;
        if (type === 'start') this.formTimer.startTime = newTime;
        else this.formTimer.endTime = newTime;
    }

    setTimePeriod(type: 'start' | 'end', period: string): void {
        const p = (period || '').toLowerCase() as 'am' | 'pm';
        const currentHour = this.getTimeHour(type);
        const currentMinute = this.getTimeMinute(type);

        let hour24 = parseInt(currentHour);
        if (p === 'pm' && hour24 !== 12) hour24 += 12;
        if (p === 'am' && hour24 === 12) hour24 = 0;

        const newTime = `${hour24.toString().padStart(2, '0')}:${currentMinute}`;
        if (type === 'start') this.formTimer.startTime = newTime;
        else this.formTimer.endTime = newTime;
    }

    setDurationValue(field: 'hours' | 'minutes' | 'seconds', value: number): void {
        if (field === 'hours') {
            this.formTimer.durationHours = Math.max(0, Math.min(24, value));
        } else if (field === 'minutes') {
            this.formTimer.durationMinutes = Math.max(0, Math.min(59, value));
        } else if (field === 'seconds') {
            this.formTimer.durationSeconds = Math.max(0, Math.min(59, value));
        }
    }

    formatScheduleMode(schedule: any): string {
        if (schedule.eventMode && schedule.duration !== undefined) {
            const hours = Math.floor(schedule.duration / 3600);
            const minutes = Math.floor((schedule.duration % 3600) / 60);
            const seconds = schedule.duration % 60;
            const parts = [];
            if (hours > 0) parts.push(`${hours}h`);
            if (minutes > 0) parts.push(`${minutes}m`);
            if (seconds > 0) parts.push(`${seconds}s`);
            return 'Event: ' + (parts.join(' ') || '0s');
        } else {
            if (schedule.allDay) {
                return this.translateService.instant('scheduler.all-day');
            }
            return this.formatTime(schedule.endTime);
        }
    }

    formatStartTime(schedule: any): string {
        if (schedule.allDay) {
            return this.translateService.instant('scheduler.all-day');
        }
        return this.formatTime(schedule.startTime);
    }

    hasEventMode(): boolean {
        // Check if current device schedules have any event mode schedules
        const schedules = this.getDeviceSchedules();
        return schedules.some(s => s.eventMode === true);
    }

    deviceHasEventMode(deviceGroup: any): boolean {
        // Check if device group has any event mode schedules
        return deviceGroup.schedules && deviceGroup.schedules.some((s: any) => s.eventMode === true);
    }

    getRemainingTime(deviceName: string, index: number): string {
        const schedule = this.schedules[deviceName]?.[index];
        const eventId = schedule?.id;
        if (!eventId) {
            return '';
        }
        const stateKey = `${deviceName}_${eventId}`;
        const remaining = this.remainingTimes.get(stateKey);

        if (remaining === undefined || remaining === null) {
            return '--';
        }

        const hours = Math.floor(remaining / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);
        const seconds = remaining % 60;

        const parts = [];
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
        parts.push(`${seconds}s`);

        return parts.join(' ');
    }

    validateTimeInput(type: 'start' | 'end', event: any): void {
        const value = event.target.value;
        // Allow manual typing validation
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (value && !timeRegex.test(value)) {
            // Reset to previous valid value or empty
            if (type === 'start') {
                this.formTimer.startTime = this.formTimer.startTime || '';
            } else {
                this.formTimer.endTime = this.formTimer.endTime || '';
            }
        }
    }

    // Remove all schedules when component is deleted from canvas
    removeAllSchedules() {
        if (this.id) {
            // Clear all device tags
            Object.keys(this.schedules).forEach(deviceName => {
                const device = this.deviceList.find(d => d.name === deviceName);
                if (device && device.variableId) {
                    this.writeDeviceTag(deviceName, 0);
                }
            });

            // Clear database
            this.hmiService.setSchedulerData(this.id, { schedules: {}, settings: {} }).pipe(
                take(1)
            ).subscribe();
        }
    }

    // Confirmation dialog methods
    confirmAction(): void {
        if (this.confirmDialogData && this.confirmDialogData.action) {
            this.confirmDialogData.action();
        }
        this.closeConfirmDialog();
    }

    closeConfirmDialog(): void {
        this.showConfirmDialog = false;
        this.confirmDialogData = null;
    }

    private formatScheduleDetails(schedule: any): string {
        const dayNames = this.dayLabelsShort;
        const monthNames = this.monthLabelsShort;

        const selectedDays = schedule.days
            .map((isSelected: boolean, index: number) => isSelected ? dayNames[index] : null)
            .filter((day: string | null) => day !== null)
            .join(', ');

        const selectedMonths = schedule.months
            .map((isSelected: boolean, index: number) => isSelected ? monthNames[index] : null)
            .filter((month: string | null) => month !== null)
            .join(', ');

        const selectedDaysOfMonth = schedule.daysOfMonth
            .map((isSelected: boolean, index: number) => isSelected ? (index + 1).toString() : null)
            .filter((day: string | null) => day !== null)
            .join(', ');

        const formatTime = (time: string) => {
            if (this.timeFormat === '12hr') {
                const [hours, minutes] = time.split(':').map(Number);
                const period = hours >= 12 ? 'PM' : 'AM';
                const hour12 = hours % 12 || 12;
                return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
            }
            return time;
        };

        const formatDuration = (seconds: number) => {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = seconds % 60;
            const parts = [];
            if (hours > 0) parts.push(`${hours}h`);
            if (minutes > 0) parts.push(`${minutes}m`);
            if (secs > 0) parts.push(`${secs}s`);
            return parts.join(' ') || '0s';
        };

        let details = '<table style="width: 100%; border-collapse: collapse; line-height: 2;">';
        details += `<tr><td class="schedule-label" style="padding: 4px 8px 4px 0;">${this.translateService.instant('scheduler.col-mode')}:</td><td style="padding: 4px 0;">${schedule.eventMode ? this.translateService.instant('scheduler.event-mode') : this.translateService.instant('scheduler.time-mode')}</td></tr>`;
        details += `<tr><td class="schedule-label" style="padding: 4px 8px 4px 0;">${this.translateService.instant('scheduler.col-device')}:</td><td style="padding: 4px 0;">${schedule.deviceName}</td></tr>`;
        details += `<tr><td class="schedule-label" style="padding: 4px 8px 4px 0;">${this.translateService.instant('scheduler.start-time')}:</td><td style="padding: 4px 0;">${formatTime(schedule.startTime)}</td></tr>`;

        if (schedule.eventMode) {
            details += `<tr><td class="schedule-label" style="padding: 4px 8px 4px 0;">${this.translateService.instant('scheduler.col-duration')}:</td><td style="padding: 4px 0;">${formatDuration(schedule.duration)}</td></tr>`;
        } else {
            details += `<tr><td class="schedule-label" style="padding: 4px 8px 4px 0;">${this.translateService.instant('scheduler.end-time')}:</td><td style="padding: 4px 0;">${formatTime(schedule.endTime)}</td></tr>`;
        }

        if (schedule.monthMode) {
            details += `<tr><td class="schedule-label" style="padding: 4px 8px 4px 0;">${this.translateService.instant('scheduler.months')}:</td><td style="padding: 4px 0;">${selectedMonths || '-'}</td></tr>`;
            details += `<tr><td class="schedule-label" style="padding: 4px 8px 4px 0;">${this.translateService.instant('scheduler.days-of-month')}:</td><td style="padding: 4px 0;">${selectedDaysOfMonth || '-'}</td></tr>`;
        } else {
            details += `<tr><td class="schedule-label" style="padding: 4px 8px 4px 0;">${this.translateService.instant('scheduler.days')}:</td><td style="padding: 4px 0;">${selectedDays || '-'}</td></tr>`;
        }

        details += `<tr><td class="schedule-label" style="padding: 4px 8px 4px 0;">${this.translateService.instant('scheduler.recurring')}:</td><td style="padding: 4px 0;">${schedule.recurring ? this.translateService.instant('general.yes') : this.translateService.instant('general.no')}</td></tr>`;
        details += `<tr><td class="schedule-label" style="padding: 4px 8px 4px 0;">${this.translateService.instant('scheduler.col-status')}:</td><td style="padding: 4px 0;">${schedule.disabled ? this.translateService.instant('general.disabled') : this.translateService.instant('general.enabled')}</td></tr>`;
        details += '</table>';

        return details;
    }

    // Update clearAllSchedules to use confirmation dialog
    clearAllSchedules(): void {
        if (!this.canModifyScheduler()) {
            return;
        }

        // Count how many schedules user can actually clear
        let scheduleCount = 0;
        if (this.selectedDevice === 'OVERVIEW') {
            // Count schedules for devices user has permission to modify
            Object.keys(this.schedules).forEach(deviceName => {
                if (this.canModifyDevice(deviceName)) {
                    scheduleCount += (this.schedules[deviceName] || []).length;
                }
            });
        } else {
            // Count schedules for selected device if user has permission
            if (this.canModifyDevice(this.selectedDevice)) {
                scheduleCount = this.getDeviceSchedules().length;
            }
        }

        if (scheduleCount === 0) {
            return;
        }

        this.confirmDialogData = {
            title: this.translateService.instant('scheduler.clear-schedules'),
            message: this.translateService.instant('scheduler.to-remove-permission', { value: scheduleCount }),
            confirmText: this.translateService.instant('general.delete'),
            icon: 'warning',
            action: () => this.executeClearAllSchedules()
        };
        this.showConfirmDialog = true;
    }

    private executeClearAllSchedules(): void {
        // Clear schedules only for devices user has permission to modify
        if (this.selectedDevice === 'OVERVIEW') {
            // In overview mode, clear schedules for all devices user can modify
            let clearedCount = 0;
            let blockedCount = 0;

            Object.keys(this.schedules).forEach(deviceName => {
                if (this.canModifyDevice(deviceName)) {
                    this.schedules[deviceName] = [];
                    this.resetDeviceTag(deviceName);
                    clearedCount++;
                } else {
                    blockedCount++;
                }
            });

        } else {
            // In device mode, clear schedules for selected device only if user has permission
            if (this.canModifyDevice(this.selectedDevice)) {
                this.schedules[this.selectedDevice] = [];
                this.resetDeviceTag(this.selectedDevice);
            } else {
                return; // Don't save if nothing was cleared
            }
        }

        this.saveSchedulesToServer(true);
        this.cdr.detectChanges();
        this.checkScheduleStates();
    }

    /** Build localized arrays from translation JSON. */
    private initI18nLists(): void {
        // general.weekdays, general.weekdays-short, general.months, general.months-short
        const wd = this.translateService.instant('general.weekdays');
        const wds = this.translateService.instant('general.weekdays-short');
        const mm = this.translateService.instant('general.months');
        const mms = this.translateService.instant('general.months-short');

        // Be defensive in case of misconfiguration:
        this.dayLabelsLong = Array.isArray(wd) ? wd : [];
        this.dayLabelsShort = Array.isArray(wds) ? wds : [];
        this.monthLabelsLong = Array.isArray(mm) ? mm : [];
        this.monthLabelsShort = Array.isArray(mms) ? mms : [];

        // Optional: simple fallbacks if any array is missing
        if (!this.dayLabelsShort.length && this.dayLabelsLong.length) {
            this.dayLabelsShort = this.dayLabelsLong.map(s => s.substring(0, 3));
        }
        if (!this.monthLabelsShort.length && this.monthLabelsLong.length) {
            this.monthLabelsShort = this.monthLabelsLong.map(s => s.substring(0, 3));
        }

        this.unnamedDevice = this.translateService.instant('scheduler.unnamed-device');
    }
}
