/**
 * FUXA Scheduler Service
 * 
 * Event-driven scheduler with master control enforcement.
 * Uses node-schedule for cron-style job scheduling.
 */

'use strict';

const schedule = require('node-schedule');

var logger;
var runtime;

// Track active node-schedule jobs by event ID
var activeJobs = new Map();

// Track scheduler writes to prevent loops
var schedulerWriting = new Set();

// Track active Event Mode schedules (key: tagId, value: { endTime, schedulerId, deviceName, eventIndex })
var activeEventModeSchedules = new Map();

/**
 * Initialize
 */
function init(settings, _logger, _runtime) {
    runtime = _runtime;
    logger = _logger || console;
    
    // Listen for tag changes to enforce master control
    runtime.events.on('tag-value:changed', onTagChanged);
    
    // Listen for EVERY client connection to send current event states
    runtime.io.on('connection', (socket) => {
        setAllInitialStates();
    });
    
    // Load existing schedulers and create jobs
    loadSchedulers();
    
    return Promise.resolve({
        updateScheduler,
        stopScheduler
    });
}

/**
 * Load all schedulers from DB and create node-schedule jobs
 */
async function loadSchedulers() {
    try {
        const schedulers = await runtime.schedulerStorage.getAllSchedulers();
        
        // Get project data to access deviceActions from property
        let projectData = null;
        try {
            projectData = await runtime.project.getProject(null, null);
        } catch (err) {
            logger.error('Failed to load project data:', err.message);
        }
        
        for (const scheduler of schedulers) {
            if (scheduler.id && scheduler.data) {
                // Get deviceActions from project property if not in scheduler.data.settings
                if (!scheduler.data.settings?.deviceActions && projectData) {
                    // Find the scheduler gauge in the project views
                    if (projectData?.hmi?.views) {
                        let found = false;
                        for (const view of projectData.hmi.views) {
                            if (view.items) {
                                for (const itemId in view.items) {
                                    const item = view.items[itemId];
                                    // Check if this is the scheduler with matching ID
                                    if (item.id === scheduler.id && item.property?.deviceActions) {
                                        // Sync to scheduler data
                                        if (!scheduler.data.settings) {
                                            scheduler.data.settings = {};
                                        }
                                        scheduler.data.settings.deviceActions = item.property.deviceActions;
                                        
                                        // Save back to database
                                        await runtime.schedulerStorage.setSchedulerData(scheduler.id, scheduler.data);
                                        found = true;
                                        break;
                                    }
                                }
                            }
                            if (found) break;
                        }
                    }
                }
                
                await createSchedulerJobs(scheduler.id, scheduler.data);
            }
        }
        
    } catch (error) {
        logger.error(`Error loading schedulers: ${error.message}`);
    }
}

/**
 * Set initial states for ALL schedulers (called after runtime ready)
 */
async function setAllInitialStates() {
    try {
        const schedulers = await runtime.schedulerStorage.getAllSchedulers();
        
        for (const scheduler of schedulers) {
            if (scheduler.id && scheduler.data) {
                await setInitialStates(scheduler.id, scheduler.data);
                await notifyEventStates(scheduler.id, scheduler.data);
            }
        }
        
    } catch (error) {
        logger.error(`Error setting initial states: ${error.message}`);
    }
}

/**
 * Notify clients of all event states for a scheduler
 */
async function notifyEventStates(schedulerId, schedulerData) {
    try {
        if (!schedulerData.settings?.devices) {
            return;
        }
        
        for (const device of schedulerData.settings.devices) {
            const schedules = schedulerData.schedules?.[device.name] || [];
            
            schedules.forEach((event, eventIndex) => {
                const dayNumbers = event.days
                    .map((enabled, index) => enabled ? index : null)
                    .filter(day => day !== null);
                
                const eventData = {
                    label: event.label || `${device.name}_${event.startTime}${event.eventMode ? '_Event_' + event.duration + 's' : '-' + event.endTime}`,
                    startTime: event.startTime,
                    endTime: event.endTime,
                    days: event.days,
                    disabled: event.disabled,
                    recurring: event.recurring,
                    eventMode: event.eventMode,
                    duration: event.duration,
                    id: event.id
                };
                
                checkAndNotifyEventState(schedulerId, device, eventData, eventIndex, dayNumbers);
            });
        }
    } catch (error) {
        logger.error(`Error notifying event states: ${error.message}`);
    }
}

/**
 * Set initial tag states based on current scheduler state
 */
async function setInitialStates(schedulerId, schedulerData) {
    try {
        if (!schedulerData.settings?.devices) {
            return;
        }
        
        for (const device of schedulerData.settings.devices) {
            const schedules = schedulerData.schedules?.[device.name] || [];
            const isTimerModeActive = checkIfAnyEventActive(schedules);
            const isEventModeActive = checkIfAnyEventModeActive(device.name, schedulerId);
            const expectedValue = (isTimerModeActive || isEventModeActive) ? 1 : 0;
            
            await writeTagFromEvent(device.variableId, expectedValue, `Initial state for ${device.name}`);
        }
    } catch (error) {
        logger.error(`Error setting initial states: ${error.message}`);
    }
}

/**
 * Create node-schedule jobs for all events in a scheduler
 */
async function createSchedulerJobs(schedulerId, schedulerData) {
    try {
        if (!schedulerData.settings?.devices) {
            return;
        }
        
        for (const device of schedulerData.settings.devices) {
            const schedules = schedulerData.schedules?.[device.name] || [];
            
            if (device.variableId) {
                runtime.events.emit('tag-change:subscription', device.variableId);
            }
            
            for (let i = 0; i < schedules.length; i++) {
                await createEventJob(schedulerId, device, schedules[i], i);
            }
        }
        
    } catch (error) {
        logger.error(`Error creating scheduler jobs: ${error.message}`);
    }
}

/**
 * Create a single event job for a device
 */
async function createEventJob(schedulerId, device, event, eventIndex) {
    try {
        const isEventMode = event.eventMode === true && event.duration !== undefined;
        
        const eventData = {
            label: isEventMode 
                ? `${device.name}_${event.startTime}_Event_${event.duration}s`
                : `${device.name}_${event.startTime}-${event.endTime}`,
            startTime: event.startTime,
            endTime: event.endTime,
            days: event.days,
            months: event.months,
            daysOfMonth: event.daysOfMonth,
            monthMode: event.monthMode,
            recurring: event.recurring !== false,
            eventMode: event.eventMode || false,
            duration: event.duration,
            id: event.id
        };
        
        // Indices shift when events are added/deleted, but IDs are stable
        const jobId = `${schedulerId}_${device.name}_${event.id}`;
        
        if (activeJobs.has(jobId)) {
            activeJobs.get(jobId).cancel();
            activeJobs.delete(jobId);
        }
        
        if (!event.days && !event.monthMode) {
            return;
        }
        
        if (event.monthMode && (!event.months || !event.daysOfMonth)) {
            return;
        }
        
        if (!event.startTime) {
            //logger.error(`Event missing start time`);
            return;
        }
        
        if (!isEventMode && !event.endTime) {
            //logger.error(`Timer mode event missing end time`);
            return;
        }
        
        if (isEventMode && (event.duration === undefined || event.duration <= 0)) {
            //logger.error(`Event mode requires valid duration`);
            return;
        }
        
        const startParts = event.startTime.split(':');
        
        if (startParts.length !== 2) {
            //logger.error(`Invalid start time format: ${event.startTime}`);
            return;
        }
        
        const startHour = parseInt(startParts[0]);
        const startMin = parseInt(startParts[1]);
        
        if (isNaN(startHour) || isNaN(startMin)) {
            //logger.error(`Invalid start time values: ${event.startTime}`);
            return;
        }
        
        let endHour, endMin;
        if (!isEventMode) {
            const endParts = event.endTime.split(':');
            
            if (endParts.length !== 2) {
                //logger.error(`Invalid end time format: ${event.endTime}`);
                return;
            }
            
            endHour = parseInt(endParts[0]);
            endMin = parseInt(endParts[1]);
            
            if (isNaN(endHour) || isNaN(endMin)) {
                //logger.error(`Invalid end time values: ${event.endTime}`);
                return;
            }
        }
        
        const dayNumbers = [];
        if (Array.isArray(event.days)) {
            event.days.forEach((isActive, dayIndex) => {
                if (isActive === true) {
                    dayNumbers.push(dayIndex);
                }
            });
        }
        
        const monthNumbers = [];
        if (Array.isArray(event.months)) {
            event.months.forEach((isActive, monthIndex) => {
                if (isActive === true) {
                    monthNumbers.push(monthIndex); // Months are 0-11 (node-schedule format)
                }
            });
        }
        
        const dayOfMonthNumbers = [];
        if (Array.isArray(event.daysOfMonth)) {
            event.daysOfMonth.forEach((isActive, dayIndex) => {
                if (isActive === true) {
                    dayOfMonthNumbers.push(dayIndex + 1); // Days are 1-31
                }
            });
        }
        
        const isMonthMode = event.monthMode === true;
        
        if (isMonthMode) {
            if (monthNumbers.length === 0 || dayOfMonthNumbers.length === 0) {
                logger.warn(`Month mode schedule rejected: no months or days selected`);
                return;
            }
        } else {
            if (dayNumbers.length === 0) {
                return;
            }
        }
        
        const startRule = new schedule.RecurrenceRule();
        if (isMonthMode) {
            startRule.month = monthNumbers;
            startRule.date = dayOfMonthNumbers;
        } else {
            startRule.dayOfWeek = dayNumbers;
        }
        startRule.hour = startHour;
        startRule.minute = startMin;
                
        let startJob = null;
        let endJob = null;
        
        try {
            startJob = schedule.scheduleJob(startRule, async () => {
                await writeTagFromEvent(device.variableId, 1, `Event "${eventData.label}" started`).catch(err => {
                    logger.error(`Error in START callback: ${err.message}`);
                });
                
                // Execute server-side device actions (Set Value, Run Script, etc.)
                const schedulers = await runtime.schedulerStorage.getAllSchedulers();
                const scheduler = schedulers.find(s => s.id === schedulerId);
                
                if (scheduler?.data?.settings) {
                    await executeDeviceActions(schedulerId, device.name, 'on', scheduler.data.settings);
                }
                
                if (runtime.io) {
                    runtime.io.emit('scheduler:event-active', { 
                        schedulerId: schedulerId,
                        deviceName: device.name, 
                        eventIndex: eventIndex,
                        eventId: event.id, 
                        eventData: eventData,
                        active: true 
                    });
                }
                
                if (isEventMode) {
                    const durationMs = event.duration * 1000;
                    const startTime = Date.now();
                    const endTime = startTime + durationMs;
                    
                    if (!event.id) {
                        logger.error(`Event missing ID! Cannot track Event Mode event.`);
                        return;
                    }
                    
                    const eventKey = event.id;
                    const activeData = {
                        endTime: endTime,
                        schedulerId: schedulerId,
                        deviceName: device.name,
                        eventIndex: eventIndex,
                        eventId: event.id,
                        variableId: device.variableId
                    };
                    activeEventModeSchedules.set(eventKey, activeData);
                    
                    const remainingTimeInterval = setInterval(() => {
                        const remainingMs = activeData.endTime - Date.now();
                        const remaining = Math.max(0, Math.floor(remainingMs / 1000));
                        
                        if (runtime.io) {
                            runtime.io.emit('scheduler:remaining-time', {
                                schedulerId: activeData.schedulerId,
                                deviceName: activeData.deviceName,
                                eventIndex: activeData.eventIndex,
                                eventId: activeData.eventId,  
                                remaining: remaining
                            });
                        }
                    }, 1000);
                    activeData.interval = remainingTimeInterval;
                    
                    const endTimeout = setTimeout(async () => {
                        const tracked = activeEventModeSchedules.get(eventKey);
                        
                        if (tracked && tracked.interval) {
                            clearInterval(tracked.interval);
                        }
                        
                        activeEventModeSchedules.delete(eventKey);
                        
                        const targetDevice = tracked ? tracked.deviceName : device.name;
                        const targetIndex = tracked ? tracked.eventIndex : eventIndex;
                        const targetVariableId = tracked ? tracked.variableId : device.variableId;
                        
                        await writeTagFromEvent(targetVariableId, 0, `Event "${eventData.label}" ended after duration`).catch(err => {
                            logger.error(`Error in duration END callback: ${err.message}`);
                        });
                        
                        // Execute server-side device actions (Set Value, Run Script, etc.)
                        const schedulers = await runtime.schedulerStorage.getAllSchedulers();
                        const scheduler = schedulers.find(s => s.id === schedulerId);
                        if (scheduler?.data?.settings) {
                            await executeDeviceActions(schedulerId, targetDevice, 'off', scheduler.data.settings);
                        }
                        
                        // Check if this is a non-recurring event that will delete itself
                        const willDelete = eventData.recurring === false;
                        let isLastDay = false;
                        if (willDelete) {
                            const currentDay = new Date().getDay();
                            isLastDay = await isLastDayOfWeekForEvent(dayNumbers, currentDay);
                        }
                        
                        // Only emit active:false if NOT deleting (deletion triggers scheduler:updated which refreshes UI)
                        if (runtime.io && !(willDelete && isLastDay)) {
                            runtime.io.emit('scheduler:event-active', { 
                                schedulerId: schedulerId,
                                deviceName: targetDevice, 
                                eventIndex: targetIndex,
                                eventId: eventData.id,  
                                eventData: eventData,
                                active: false 
                            });
                        }
                        
                        if (willDelete && isLastDay) {
                            await removeOneTimeEvent(schedulerId, targetDevice, targetIndex, eventData.id);
                        }
                    }, durationMs);
                    activeData.endTimeout = endTimeout;
                }
            });
        } catch (scheduleError) {
            logger.error(`Error scheduling START job: ${scheduleError.message}`);
        }
        
        if (!isEventMode) {
            const endRule = new schedule.RecurrenceRule();
            if (isMonthMode) {
                endRule.month = monthNumbers;
                endRule.date = dayOfMonthNumbers;
            } else {
                endRule.dayOfWeek = dayNumbers;
            }
            endRule.hour = endHour;
            endRule.minute = endMin;
            
            try {
                endJob = schedule.scheduleJob(endRule, async () => {
                    await writeTagFromEvent(device.variableId, 0, `Event "${eventData.label}" ended`).catch(err => {
                        logger.error(`Error in END callback: ${err.message}`);
                    });
                    
                    // Execute server-side device actions (Set Value, Run Script, etc.)
                    const schedulers = await runtime.schedulerStorage.getAllSchedulers();
                    const scheduler = schedulers.find(s => s.id === schedulerId);
                    if (scheduler?.data?.settings) {
                        await executeDeviceActions(schedulerId, device.name, 'off', scheduler.data.settings);
                    }
                    
                    // Check if this is a non-recurring event that will delete itself
                    const willDelete = eventData.recurring === false;
                    let isLastDay = false;
                    if (willDelete) {
                        const currentDay = new Date().getDay();
                        isLastDay = await isLastDayOfWeekForEvent(dayNumbers, currentDay);
                    }
                    
                    // Only emit active:false if NOT deleting (deletion triggers scheduler:updated which refreshes UI)
                    if (runtime.io && !(willDelete && isLastDay)) {
                        runtime.io.emit('scheduler:event-active', { 
                            schedulerId: schedulerId,
                            deviceName: device.name, 
                            eventIndex: eventIndex,
                            eventId: eventData.id,  
                            eventData: eventData,
                            active: false 
                        });
                    }
                    
                    if (willDelete && isLastDay) {
                        await removeOneTimeEvent(schedulerId, device.name, eventIndex, eventData.id);
                    }
                });
            } catch (scheduleError) {
                logger.error(`Error scheduling END job: ${scheduleError.message}`);
            }
        }
        
        if (startJob) {
            activeJobs.set(`${jobId}_start`, startJob);
        }
        if (endJob) {
            activeJobs.set(`${jobId}_end`, endJob);
        }
        
        if (isEventMode) {
            if (!event.id) {
                logger.error(`Event missing ID! Cannot check for transfer.`);
                return;
            }
            
            const activeKey = event.id;
            if (activeEventModeSchedules.has(activeKey)) {
                const activeData = activeEventModeSchedules.get(activeKey);
                
                if (activeData.interval) {
                    clearInterval(activeData.interval);
                    activeData.interval = null;
                }
                
                activeData.deviceName = device.name;
                activeData.eventIndex = eventIndex;
                activeData.variableId = device.variableId;
                activeEventModeSchedules.set(activeKey, activeData);
                
                await writeTagFromEvent(device.variableId, 1, `Transferred Event Mode event started on ${device.name}`);
                
                if (runtime.io) {
                    const remainingTime = Math.max(0, Math.ceil((activeData.endTime - Date.now()) / 1000));
                    runtime.io.emit('scheduler:event-active', { 
                        schedulerId: schedulerId,
                        deviceName: device.name, 
                        eventIndex: eventIndex,
                        eventId: event.id,  
                        eventData: eventData,
                        active: true,
                        remainingTime: remainingTime
                    });
                    
                    const transferredInterval = setInterval(() => {
                        const remainingMs = activeData.endTime - Date.now();
                        const remaining = Math.max(0, Math.floor(remainingMs / 1000));
                        
                        if (runtime.io && remaining > 0) {
                            runtime.io.emit('scheduler:remaining-time', {
                                schedulerId: activeData.schedulerId,
                                deviceName: activeData.deviceName,
                                eventIndex: activeData.eventIndex,
                                eventId: activeData.eventId, 
                                remaining: remaining
                            });
                        } else if (remaining <= 0) {
                            clearInterval(transferredInterval);
                        }
                    }, 1000);
                    activeData.interval = transferredInterval;
                }
            }
        }
                
    } catch (error) {
        logger.error(`Error creating job for event: ${error.message}`);
        logger.error(error.stack);
    }
}

/**
 * Check if event should be active right now and notify clients
 */
function checkAndNotifyEventState(schedulerId, device, eventData, eventIndex, dayNumbers) {
    try {
        const now = new Date();
        const currentDay = now.getDay();
        const currentHour = now.getHours();
        const currentMin = now.getMinutes();
        const currentTimeInMinutes = currentHour * 60 + currentMin;
        
        if (eventData.eventMode === true) {
            if (!eventData.id) {
                // Event has no ID, treat as inactive
                if (runtime.io) {
                    runtime.io.emit('scheduler:event-active', {
                        schedulerId: schedulerId,
                        deviceName: device.name,
                        eventIndex: eventIndex,
                        eventData: eventData,
                        active: false
                    });
                }
                return;
            }
            
            const eventKey = eventData.id;
            const activeEventMode = activeEventModeSchedules.get(eventKey);
            const isActive = !!(activeEventMode && activeEventMode.endTime > Date.now());
            
            if (runtime.io) {
                runtime.io.emit('scheduler:event-active', {
                    schedulerId: schedulerId,
                    deviceName: device.name,
                    eventIndex: eventIndex,
                    eventId: eventData.id,  
                    eventData: eventData,
                    active: isActive
                });
                
                if (isActive && eventData.duration) {
                    const remainingMs = activeEventMode.endTime - Date.now();
                    const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
                    runtime.io.emit('scheduler:remaining-time', {
                        schedulerId: schedulerId,
                        deviceName: device.name,
                        eventIndex: eventIndex,
                        eventId: eventData.id,  
                        remaining: remainingSeconds
                    });
                }
            }
            return;
        }
        
        if (!dayNumbers.includes(currentDay)) {
            if (runtime.io) {
                runtime.io.emit('scheduler:event-active', {
                    schedulerId: schedulerId,
                    deviceName: device.name,
                    eventIndex: eventIndex,
                    eventId: eventData.id,  
                    eventData: eventData,
                    active: false
                });
            }
            return;
        }
        
        if (!eventData.endTime) {
            return;
        }
        
        const [startHour, startMin] = eventData.startTime.split(':').map(Number);
        const [endHour, endMin] = eventData.endTime.split(':').map(Number);
        const startTimeInMinutes = startHour * 60 + startMin;
        const endTimeInMinutes = endHour * 60 + endMin;
        
        let isActive = false;
        if (endTimeInMinutes > startTimeInMinutes) {
            isActive = currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes;
        } else {
            isActive = currentTimeInMinutes >= startTimeInMinutes || currentTimeInMinutes < endTimeInMinutes;
        }
        
        if (runtime.io) {
            runtime.io.emit('scheduler:event-active', {
                schedulerId: schedulerId,
                deviceName: device.name,
                eventIndex: eventIndex,
                eventId: eventData.id,  
                eventData: eventData,
                active: isActive
            });
        }
    } catch (error) {
        logger.error(`Error checking event state: ${error.message}`);
    }
}

/**
 * Check if the current day is the last scheduled day in the current week
 */
async function isLastDayOfWeekForEvent(dayNumbers, currentDay) {
    const remainingDays = dayNumbers.filter(day => day >= currentDay);
    
    if (remainingDays.length === 0) {
        return true;
    }
    
    remainingDays.sort((a, b) => a - b);
    return currentDay === remainingDays[remainingDays.length - 1];
}

/**
 * Remove a one-time event after it has executed
 */
async function removeOneTimeEvent(schedulerId, deviceName, eventIndex, eventId) {
    try {
        const schedulerData = await runtime.schedulerStorage.getSchedulerData(schedulerId);
        if (!schedulerData) {
            logger.warn(`Cannot remove one-time event: scheduler ${schedulerId} not found`);
            return;
        }
        
        const deviceSchedules = schedulerData.schedules?.[deviceName];
        if (!deviceSchedules || !Array.isArray(deviceSchedules)) {
            logger.warn(`Cannot remove one-time event: no schedules for device ${deviceName}`);
            return;
        }
        
        // Find event by ID (most reliable) or fallback to index
        let actualEventIndex = -1;
        if (eventId) {
            actualEventIndex = deviceSchedules.findIndex(e => e.id === eventId);
        }
        if (actualEventIndex === -1 && eventIndex >= 0 && eventIndex < deviceSchedules.length) {
            actualEventIndex = eventIndex;
        }
        
        if (actualEventIndex < 0 || actualEventIndex >= deviceSchedules.length) {
            logger.warn(`Cannot remove one-time event: event not found (id=${eventId}, index=${eventIndex})`);
            return;
        }
        
        const removedEvent = deviceSchedules.splice(actualEventIndex, 1)[0];
        
        // Clean up any active Event Mode data for this event BEFORE saving/emitting
        // This prevents race conditions where notifyEventStates() sees stale active data
        if (eventId && activeEventModeSchedules.has(eventId)) {
            const activeData = activeEventModeSchedules.get(eventId);
            if (activeData.interval) {
                clearInterval(activeData.interval);
            }
            if (activeData.endTimeout) {
                clearTimeout(activeData.endTimeout);
            }
            activeEventModeSchedules.delete(eventId);
        }
        
        await runtime.schedulerStorage.setSchedulerData(schedulerId, schedulerData);
        
        // Cancel jobs using event ID if available
        const jobIdBase = eventId ? `${schedulerId}_${deviceName}_${eventId}` : `${schedulerId}_${deviceName}_${actualEventIndex}`;
        const startJobKey = `${jobIdBase}_start`;
        const endJobKey = `${jobIdBase}_end`;
        
        if (activeJobs.has(startJobKey)) {
            activeJobs.get(startJobKey).cancel();
            activeJobs.delete(startJobKey);
        }
        if (activeJobs.has(endJobKey)) {
            activeJobs.get(endJobKey).cancel();
            activeJobs.delete(endJobKey);
        }
        
        if (runtime.io) {
            runtime.io.emit('scheduler:updated', { id: schedulerId, data: schedulerData });
        }
        
    } catch (error) {
        logger.error(`Error removing one-time event: ${error.message}`);
        logger.error(error.stack);
    }
}

/**
 * Write tag value from event (with loop prevention)
 */
async function writeTagFromEvent(tagId, value, reason) {
    try {
        schedulerWriting.add(tagId);
        
        const result = await runtime.devices.setTagValue(tagId, value);
        
        if (result) {
            const deviceId = getDeviceIdFromTag(tagId);
            if (deviceId) {
                const values = {};
                values[tagId] = {
                    id: tagId,
                    value: value,
                    timestamp: Date.now()
                };
                runtime.events.emit('device-value:changed', { id: deviceId, values: values });
            }
        }
        
        setTimeout(() => {
            schedulerWriting.delete(tagId);
        }, 1000);
        
    } catch (error) {
        logger.error(`Error writing tag: ${error.message}`);
        schedulerWriting.delete(tagId);
    }
}

/**
 * Get device ID from tag ID
 */
function getDeviceIdFromTag(tagId) {
    try {
        const parts = tagId.split('.');
        if (parts.length > 1) {
            return parts[0];
        }
        return 'FuxaServer';
    } catch (err) {
        return null;
    }
}

/**
 * MASTER CONTROL: When tag changes externally, check if event should override it
 */
async function onTagChanged(tagEvent) {
    const tagId = tagEvent.id;
    const currentValue = tagEvent.value ? 1 : 0;
    
    if (schedulerWriting.has(tagId)) {
        return;
    }
    
    try {
        const schedulers = await runtime.schedulerStorage.getAllSchedulers();
        
        let device = null;
        let controllingScheduler = null;
        
        for (const scheduler of schedulers) {
            if (scheduler.data?.settings?.devices) {
                device = scheduler.data.settings.devices.find(d => d.variableId === tagId);
                if (device) {
                    controllingScheduler = scheduler;
                    break;
                }
            }
        }
        
        if (!device || !controllingScheduler) {
            return;
        }
        
        const schedules = controllingScheduler.data.schedules?.[device.name] || [];
        
        let isEventModeActive = false;
        for (const [key, eventInfo] of activeEventModeSchedules.entries()) {
            if (eventInfo.variableId === tagId && eventInfo.endTime > Date.now()) {
                isEventModeActive = true;
                break;
            }
        }
        
        const isTimerModeActive = checkIfAnyEventActive(schedules);
        const isEventActive = isEventModeActive || isTimerModeActive;
        const expectedValue = isEventActive ? 1 : 0;
        
        if (currentValue !== expectedValue) {
            await writeTagFromEvent(tagId, expectedValue, 'Master control enforcement');
        }
        
    } catch (error) {
        logger.error(`Error in onTagChanged: ${error.message}`);
    }
}

/**
 * Check if any event is currently active
 */
function checkIfAnyEventActive(schedules) {
    if (!schedules || schedules.length === 0) {
        return false;
    }
    
    const now = new Date();
    const currentDay = now.getDay();
    const currentMonth = now.getMonth(); // 0-11
    const currentDate = now.getDate(); // 1-31
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    for (const event of schedules) {
        // Check day-of-week mode
        if (!event.monthMode && event.days && event.days.length > 0) {
            if (event.days[currentDay] !== true) {
                continue;
            }
        }
        // Check month mode
        else if (event.monthMode && event.months && event.daysOfMonth) {
            if (event.months[currentMonth] !== true || event.daysOfMonth[currentDate - 1] !== true) {
                continue;
            }
        }
        else {
            continue;
        }
        
        if (event.eventMode === true) {
            continue;
        }
        
        if (!event.endTime) {
            continue;
        }
        
        const [startHour, startMin] = event.startTime.split(':').map(Number);
        const [endHour, endMin] = event.endTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        
        let inRange = false;
        if (endMinutes < startMinutes) {
            inRange = currentMinutes >= startMinutes || currentMinutes < endMinutes;
        } else {
            inRange = currentMinutes >= startMinutes && currentMinutes < endMinutes;
        }
        
        if (inRange) {
            return true;
        }
    }
    
    return false;
}

/**
 * Check if any Event Mode events are currently active for a device
 */
function checkIfAnyEventModeActive(deviceName, schedulerId) {
    for (const [key, eventInfo] of activeEventModeSchedules.entries()) {
        if (eventInfo.deviceName === deviceName && eventInfo.schedulerId === schedulerId) {
            return true;
        }
    }
    return false;
}

/**
 * Update scheduler
 */
async function updateScheduler(schedulerId, schedulerData, oldData = null) {
    try {
        if (!oldData) {
            const schedulers = await runtime.schedulerStorage.getAllSchedulers();
            const previousScheduler = schedulers.find(s => s.id === schedulerId);
            oldData = previousScheduler?.data;
        }
        
        if (oldData) {
            await handleTagChanges(schedulerId, oldData, schedulerData);
        }
        
        // Handle Event Mode duration changes BEFORE stopping/recreating jobs
        if (oldData) {
            await handleEventModifications(schedulerId, oldData, schedulerData);
        }
        
        if (oldData) {
            await handleEventDeletions(schedulerId, oldData, schedulerData);
        }
        
        stopScheduler(schedulerId);
        await createSchedulerJobs(schedulerId, schedulerData);
        await setInitialStates(schedulerId, schedulerData);
        
        // Notify all event states after update to ensure client has correct indices
        await notifyEventStates(schedulerId, schedulerData);
        
    } catch (error) {
        logger.error(`Error in updateScheduler: ${error.message}`);
    }
}

/**
 * Handle tag changes - reset old tags to 0 when device tag changes
 */
async function handleTagChanges(schedulerId, oldData, newData) {
    if (!oldData?.settings?.devices) {
        return;
    }
    
    const oldDevicesByName = new Map();
    for (const device of oldData.settings.devices) {
        oldDevicesByName.set(device.name, device);
    }
    
    const newDevicesByName = new Map();
    if (newData?.settings?.devices) {
        for (const device of newData.settings.devices) {
            newDevicesByName.set(device.name, device);
        }
    }
    
    for (const [deviceName, oldDevice] of oldDevicesByName) {
        const newDevice = newDevicesByName.get(deviceName);
        
        if (!newDevice) {
            await writeTagFromEvent(oldDevice.variableId, 0, 'Device deleted from scheduler');
        } else if (oldDevice.variableId !== newDevice.variableId) {
            await writeTagFromEvent(oldDevice.variableId, 0, 'Tag change - resetting old tag');
        }
    }
}

/**
 * Handle Event Mode duration changes for RUNNING events
 */
async function handleEventModifications(schedulerId, oldData, newData) {
    if (!oldData?.settings?.devices || !newData?.settings?.devices) {
        return;
    }
    
    // Check each device for events that exist in both old and new data
    for (const device of newData.settings.devices) {
        const oldSchedules = oldData.schedules?.[device.name] || [];
        const newSchedules = newData.schedules?.[device.name] || [];
        
        for (const newEvent of newSchedules) {
            if (!newEvent.eventMode || !newEvent.id) continue;
            
            // Find the corresponding old event by ID
            const oldEvent = oldSchedules.find(e => e.id === newEvent.id);
            if (!oldEvent) continue; // Event is new, not modified
            
            // Check if duration changed
            if (oldEvent.duration !== newEvent.duration) {
                // Check if this event is currently running
                const eventKey = newEvent.id;
                const activeData = activeEventModeSchedules.get(eventKey);
                
                if (activeData) {
                    // Clear the old interval and timeout
                    if (activeData.interval) {
                        clearInterval(activeData.interval);
                        activeData.interval = null;
                    }
                    if (activeData.endTimeout) {
                        clearTimeout(activeData.endTimeout);
                        activeData.endTimeout = null;
                    }
                                        
                    const newDurationMs = newEvent.duration * 1000;
                    const newEndTime = Date.now() + newDurationMs;
                    activeData.endTime = newEndTime;
                    
                    // Create new countdown interval
                    const newInterval = setInterval(() => {
                        const remainingMs = activeData.endTime - Date.now();
                        const remaining = Math.max(0, Math.floor(remainingMs / 1000));
                        
                        if (runtime.io) {
                            runtime.io.emit('scheduler:remaining-time', {
                                schedulerId: activeData.schedulerId,
                                deviceName: activeData.deviceName,
                                eventIndex: activeData.eventIndex,
                                eventId: activeData.eventId,
                                remaining: remaining
                            });
                        }
                    }, 1000);
                    activeData.interval = newInterval;
                    
                    // Create new END timeout with updated event data
                    const newEndTimeout = setTimeout(async () => {
                        const tracked = activeEventModeSchedules.get(eventKey);
                        
                        if (tracked && tracked.interval) {
                            clearInterval(tracked.interval);
                        }
                        
                        activeEventModeSchedules.delete(eventKey);
                        
                        const targetDevice = tracked ? tracked.deviceName : device.name;
                        const targetIndex = tracked ? tracked.eventIndex : newSchedules.indexOf(newEvent);
                        const targetVariableId = tracked ? tracked.variableId : device.variableId;
                        
                        await writeTagFromEvent(targetVariableId, 0, `Event ended after modified duration`).catch(err => {
                            logger.error(`Error in modified duration END callback: ${err.message}`);
                        });
                        
                        // Check if this is a non-recurring event that will delete itself
                        const dayNumbers = [];
                        if (Array.isArray(newEvent.days)) {
                            newEvent.days.forEach((isActive, dayIndex) => {
                                if (isActive === true) dayNumbers.push(dayIndex);
                            });
                        }
                        
                        const willDelete = newEvent.recurring === false;
                        let isLastDay = false;
                        if (willDelete) {
                            const currentDay = new Date().getDay();
                            isLastDay = await isLastDayOfWeekForEvent(dayNumbers, currentDay);
                        }
                        
                        // Only emit active:false if NOT deleting
                        if (runtime.io && !(willDelete && isLastDay)) {
                            runtime.io.emit('scheduler:event-active', { 
                                schedulerId: schedulerId,
                                deviceName: targetDevice, 
                                eventIndex: targetIndex,
                                eventId: newEvent.id,
                                eventData: {
                                    label: newEvent.label || `${device.name}_Event`,
                                    startTime: newEvent.startTime,
                                    eventMode: true,
                                    duration: newEvent.duration,
                                    id: newEvent.id
                                },
                                active: false 
                            });
                        }
                        
                        if (willDelete && isLastDay) {
                            await removeOneTimeEvent(schedulerId, targetDevice, targetIndex, newEvent.id);
                        }
                    }, newDurationMs);
                    activeData.endTimeout = newEndTimeout;
                    
                    // Update the stored activeData
                    activeEventModeSchedules.set(eventKey, activeData);
                    
                    // Immediately emit the new remaining time to client
                    if (runtime.io) {
                        runtime.io.emit('scheduler:remaining-time', {
                            schedulerId: schedulerId,
                            deviceName: device.name,
                            eventIndex: newSchedules.indexOf(newEvent),
                            eventId: newEvent.id,
                            remaining: newEvent.duration
                        });
                    }
                }
            }
        }
    }
}

/**
 * Handle event deletions
 */
async function handleEventDeletions(schedulerId, oldData, newData) {
    if (!oldData?.settings?.devices || !newData?.settings?.devices) {
        return;
    }
    
    const oldEventsByDevice = new Map();
    for (const device of oldData.settings.devices) {
        const schedules = oldData.schedules?.[device.name] || [];
        for (const event of schedules) {
            if (!oldEventsByDevice.has(device.name)) {
                oldEventsByDevice.set(device.name, []);
            }
            oldEventsByDevice.get(device.name).push({ device, event });
        }
    }
    
    const newEventsByDevice = new Map();
    for (const device of newData.settings.devices) {
        const schedules = newData.schedules?.[device.name] || [];
        for (const event of schedules) {
            if (!newEventsByDevice.has(device.name)) {
                newEventsByDevice.set(device.name, []);
            }
            newEventsByDevice.get(device.name).push(event);
        }
    }
    
    for (const [deviceName, oldDeviceEvents] of oldEventsByDevice) {
        const newDeviceEvents = newEventsByDevice.get(deviceName) || [];
        const newEventIds = new Set(newDeviceEvents.map(e => e.id));
        
        const deletedEvents = oldDeviceEvents.filter(({ event }) => !newEventIds.has(event.id));
        
        if (deletedEvents.length > 0) {
            for (const { device, event } of deletedEvents) {
                const startJobId = `${schedulerId}_${device.name}_${event.id}_start`;
                const endJobId = `${schedulerId}_${device.name}_${event.id}_end`;
                
                let wasTransferred = false;
                if (event.eventMode && event.duration !== undefined) {
                    for (const [otherDeviceName, otherDeviceEvents] of newEventsByDevice) {
                        if (otherDeviceName !== deviceName) {
                            const matchingEvent = otherDeviceEvents.find(e => e.id === event.id);
                            if (matchingEvent) {
                                const oldEventIndex = oldDeviceEvents.findIndex(({ event: e }) => e === event);
                                const newEventIndex = newDeviceEvents.findIndex(e => e.id === event.id);
                                const oldEventKey = event.id;
                                const newEventKey = event.id;
                                let activeData = null;
                                
                                if (activeEventModeSchedules.has(oldEventKey)) {
                                    activeData = activeEventModeSchedules.get(oldEventKey);
                                } else {
                                    const oldEventKeyIndex = `${schedulerId}_${device.name}_${oldEventIndex}`;
                                    if (activeEventModeSchedules.has(oldEventKeyIndex)) {
                                        activeData = activeEventModeSchedules.get(oldEventKeyIndex);
                                    }
                                }
                                
                                if (activeData) {
                                    if (runtime.io) {
                                        runtime.io.emit('scheduler:event-active', { 
                                            schedulerId: schedulerId,
                                            deviceName: device.name, 
                                            eventIndex: oldEventIndex,
                                            eventId: event.id, 
                                            eventData: {
                                                label: `Transferred from ${device.name}`,
                                                startTime: event.startTime,
                                                eventMode: true,
                                                duration: event.duration,
                                                id: event.id
                                            },
                                            active: false 
                                        });
                                    }
                                    
                                    if (activeEventModeSchedules.has(oldEventKey)) {
                                        activeEventModeSchedules.delete(oldEventKey);
                                    } else {
                                        const oldEventKeyIndex2 = `${schedulerId}_${device.name}_${oldEventIndex}`;
                                        activeEventModeSchedules.delete(oldEventKeyIndex2);
                                    }
                                    
                                    activeData.deviceName = otherDeviceName;
                                    activeData.eventIndex = newEventIndex;
                                    activeData.variableId = newData.settings.devices.find(d => d.name === otherDeviceName)?.variableId || activeData.variableId;
                                    
                                    activeEventModeSchedules.set(newEventKey, activeData);
                                    wasTransferred = true;
                                }
                                break;
                            }
                        }
                    }
                }
                
                if (!wasTransferred) {
                    if (activeJobs.has(startJobId)) {
                        activeJobs.get(startJobId).cancel();
                        activeJobs.delete(startJobId);
                    }
                    
                    if (activeJobs.has(endJobId)) {
                        activeJobs.get(endJobId).cancel();
                        activeJobs.delete(endJobId);
                    }
                    
                    // If this is an Event Mode event that's currently running, stop it immediately
                    if (event.eventMode && event.id) {
                        // Find the event index in oldDeviceEvents
                        const oldEventIndex = oldDeviceEvents.findIndex(({ event: e }) => e === event);
                        
                        // Find the event in activeEventModeSchedules - it could be keyed by ID or other patterns
                        const possibleKeys = [
                            event.id,
                            `${schedulerId}_${device.name}_${event.id}`,
                            oldEventIndex,
                            `${schedulerId}_${device.name}_${oldEventIndex}`
                        ];
                        
                        let activeData = null;
                        let foundKey = null;
                        
                        for (const key of possibleKeys) {
                            if (activeEventModeSchedules.has(key)) {
                                activeData = activeEventModeSchedules.get(key);
                                foundKey = key;
                                break;
                            }
                        }
                        
                        if (activeData) {
                            // Clear the remaining time interval (stored as 'interval', not 'intervalId')
                            if (activeData.interval) {
                                clearInterval(activeData.interval);
                                activeData.interval = null;
                            }
                            
                            // Clear the END timeout (stored as 'endTimeout', not 'endTimeoutId')
                            if (activeData.endTimeout) {
                                clearTimeout(activeData.endTimeout);
                                activeData.endTimeout = null;
                            }
                            
                            // Remove from active schedules using the key we found
                            activeEventModeSchedules.delete(foundKey);
                            
                            // Also try to delete any other possible keys just to be thorough
                            for (const key of possibleKeys) {
                                if (key !== foundKey) {
                                    activeEventModeSchedules.delete(key);
                                }
                            }
                            
                            // Emit INACTIVE state to client
                            if (runtime.io) {
                                runtime.io.emit('scheduler:event-active', { 
                                    schedulerId: schedulerId,
                                    deviceName: device.name, 
                                    eventIndex: activeData.eventIndex,
                                    eventId: event.id,  
                                    eventData: {
                                        label: event.label || `${device.name}_Event`,
                                        startTime: event.startTime,
                                        eventMode: true,
                                        duration: event.duration,
                                        id: event.id
                                    },
                                    active: false 
                                });
                            }
                            
                            // Write tag to 0 immediately
                            await writeTagFromEvent(device.variableId, 0, 'Event deleted while active');
                        }
                    }
                }
            }
            
            const remainingActive = checkIfAnyEventActive(newDeviceEvents);
            
            if (!remainingActive) {
                const device = deletedEvents[0].device;
                await writeTagFromEvent(device.variableId, 0, 'Event deletion');
            }
        }
    }
}

/**
 * Stop all jobs for a scheduler
 */
function stopScheduler(schedulerId) {
    let cancelled = 0;
    
    for (const [jobId, job] of activeJobs) {
        if (jobId.startsWith(schedulerId)) {
            job.cancel();
            activeJobs.delete(jobId);
            cancelled++;
        }
    }
}

/**
 * Remove scheduler completely
 */
async function removeScheduler(schedulerId) {
    try {
        const schedulers = await runtime.schedulerStorage.getAllSchedulers();
        const scheduler = schedulers.find(s => s.id === schedulerId);
        
        if (scheduler?.data?.settings?.devices) {
            for (const device of scheduler.data.settings.devices) {
                await writeTagFromEvent(device.variableId, 0, 'Scheduler deleted');
            }
        }
        
        stopScheduler(schedulerId);
        
    } catch (error) {
        logger.error(`Error in removeScheduler: ${error.message}`);
    }
}

/**
 * Execute device actions (Set Value, Toggle Value, Run Script) when a scheduler event fires
 * @param {string} schedulerId - Scheduler ID
 * @param {string} deviceName - Device name that triggered
 * @param {string} trigger - 'on' or 'off'
 * @param {object} schedulerSettings - Scheduler settings containing deviceActions
 */
async function executeDeviceActions(schedulerId, deviceName, trigger, schedulerSettings) {
    
    if (!schedulerSettings?.deviceActions || !Array.isArray(schedulerSettings.deviceActions)) {
        return;
    }
        
    // Filter actions for this device and trigger type
    const deviceActions = schedulerSettings.deviceActions.filter(action => 
        action.deviceName === deviceName && 
        (action.eventTrigger === trigger || (!action.eventTrigger && trigger === 'on'))
    );
    
    if (deviceActions.length === 0) {
        return;
    }
        
    for (const action of deviceActions) {
        if (!action.action) {
            continue;
        }
        
        try {
            // Handle SERVER-SIDE actions only (Set Value, Toggle Value, Run Script)
            switch (action.action) {
                case 'onSetValue':
                    await handleSetValue(action);
                    break;
                    
                case 'onToggleValue':
                    await handleToggleValue(action);
                    break;
                    
                case 'onRunScript':
                    await handleRunScript(action);
                    break;
                    
                default:
                    logger.warn('Unknown or unsupported action type: ' + action.action);
                    break;
            }
        } catch (error) {
            logger.error('Action execution error - Device: ' + deviceName + ', Action: ' + action.action + ', Error: ' + error.message);
        }
    }
}

/**
 * Handle Set Value action server-side
 */
async function handleSetValue(action) {
    if (!action.actoptions?.variable?.variableId) {
        logger.warn('Missing variable ID for set value action');
        return;
    }
    
    const variableId = action.actoptions.variable.variableId;
    let value = action.actparam || '0';
    
    // Parse value based on variable type
    const variableRaw = action.actoptions.variable.variableRaw;
    if (variableRaw && variableRaw.type === 'number') {
        value = parseFloat(value);
    } else if (variableRaw && variableRaw.type === 'boolean') {
        value = value === 'true' || value === '1' || value === 1;
    }
    
    // Get device ID from tag ID
    const deviceId = runtime.devices.getDeviceIdFromTag(variableId);
    if (!deviceId) {
        logger.error('Device not found for variable: ' + variableId);
        return;
    }
    
    // Handle function (add/remove)
    if (action.actoptions.function) {
        const currentValueObj = runtime.devices.getDeviceValue(deviceId, variableId);
        const currentValue = currentValueObj ? currentValueObj.value : 0;
        if (action.actoptions.function === 'add') {
            value = (parseFloat(currentValue) || 0) + parseFloat(value);
        } else if (action.actoptions.function === 'remove') {
            value = (parseFloat(currentValue) || 0) - parseFloat(value);
        }
    }
    
    try {
        const result = await runtime.devices.setTagValue(variableId, value);
        
        if (result) {
            // Get the actual current value from the device to ensure it's properly typed
            const currentValueObj = runtime.devices.getDeviceValue(deviceId, variableId);
            const actualValue = currentValueObj ? currentValueObj.value : value;
            
            // Directly broadcast to all clients via Socket.IO (bypass subscription filtering)
            const values = {};
            values[variableId] = {
                id: variableId,
                value: actualValue,
                timestamp: Date.now()
            };
            
            // Force broadcast to ALL clients
            runtime.io.emit('device-values', {
                id: deviceId,
                values: [values[variableId]]
            });
        }
    } catch (error) {
        logger.error('Error setting value: ' + error.message);
    }
}

/**
 * Handle Toggle Value action server-side
 */
async function handleToggleValue(action) {
    if (!action.actoptions?.variable?.variableId) {
        logger.warn('Missing variable ID for toggle action');
        return;
    }
    
    const variableId = action.actoptions.variable.variableId;
    const bitmask = action.actoptions.variable.bitmask;
    
    // Get device ID from tag ID
    const deviceId = runtime.devices.getDeviceIdFromTag(variableId);
    if (!deviceId) {
        logger.error('Device not found for variable: ' + variableId);
        return;
    }
    
    const currentValueObj = runtime.devices.getDeviceValue(deviceId, variableId);
    const currentValue = currentValueObj ? currentValueObj.value : 0;
    
    let newValue;
    if (bitmask) {
        // Toggle specific bit(s)
        newValue = (parseInt(currentValue) || 0) ^ bitmask;
    } else {
        // Toggle boolean
        newValue = currentValue ? 0 : 1;
    }
    
    try {
        const result = await runtime.devices.setTagValue(variableId, newValue);
        
        if (result) {
            // Get the actual current value to confirm
            const actualValueObj = runtime.devices.getDeviceValue(deviceId, variableId);
            const actualValue = actualValueObj ? actualValueObj.value : newValue;
            
            // Directly broadcast to all clients via Socket.IO (bypass subscription filtering)
            const values = {};
            values[variableId] = {
                id: variableId,
                value: actualValue,
                timestamp: Date.now()
            };
            
            // Force broadcast to ALL clients
            runtime.io.emit('device-values', {
                id: deviceId,
                values: [values[variableId]]
            });
        }
    } catch (error) {
        logger.error('Error toggling value: ' + error.message);
    }
}

/**
 * Handle Run Script action server-side
 */
async function handleRunScript(action) {
    if (!action.actparam) {
        logger.warn('Missing script ID for run script action');
        return;
    }
    
    const scriptId = action.actparam;
    
    // Create script object to execute
    const script = {
        id: scriptId,
        name: null,
        parameters: action.actoptions?.params || null,
        notLog: true
    };
    
    try {
        await runtime.scriptsMgr.runScript(script, true);
        
        // After script execution, broadcast all FUXA Server device tags to ensure clients see any changes
        // Scripts can modify internal tags, so we need to force an update by triggering a device value change event
        const allDeviceValues = runtime.devices.getDevicesValues();
        
        // Emit device-value:changed for each device that has values
        for (const deviceId in allDeviceValues) {
            const deviceTags = allDeviceValues[deviceId];
            if (deviceTags && Object.keys(deviceTags).length > 0) {
                // Build values object with current tag values
                const values = {};
                for (const tagId in deviceTags) {
                    const tagValue = runtime.devices.getDeviceValue(deviceId, tagId);
                    if (tagValue) {
                        values[tagId] = tagValue;
                    }
                }
                
                if (Object.keys(values).length > 0) {
                    // Directly broadcast to all clients via Socket.IO
                    runtime.io.emit('device-values', {
                        id: deviceId,
                        values: Object.values(values)
                    });
                }
            }
        }
    } catch (error) {
        logger.error('Script execution error: ' + error.message);
    }
}

module.exports = {
    init,
    updateScheduler,
    stopScheduler,
    removeScheduler
};
