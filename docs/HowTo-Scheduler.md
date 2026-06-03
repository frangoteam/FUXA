# HowTo Scheduler

The Scheduler is a powerful time-based automation system in FUXA that allows you to create events that trigger at specific times based on days of the week, days of the month, and months. It provides both timer mode (on/off periods) and event mode (duration-based triggers) with full device control capabilities.

## Overview

The Scheduler enables automated control of devices and tags based on time schedules. Key features include:

- **Day-of-Week Scheduling**: Schedule events for specific days (Monday-Sunday)
- **Month Mode**: Advanced scheduling by month and day-of-month combinations
- **Timer Mode**: Define start and end times for on/off periods
- **Event Mode**: Trigger events for specific durations
- **Device Actions**: Execute additional actions like setting values or running scripts
- **Master Control**: Scheduler acts as master controller for device tags

## Scheduling Modes

### Day-of-Week Mode

The default scheduling mode allows you to select specific days of the week for your events.

- **Days**: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
- **Time Range**: Define start time and end time for timer mode, or start time and duration for event mode
- **Visual Indicators**: Selected days are highlighted in the schedule display

### Month Mode

Advanced scheduling that combines month and day-of-month selections for precise control.

- **Months**: January through December
- **Days of Month**: 1st through 31st
- **Important Notes**:
  - If a month has fewer than 31 days (e.g., February with 28 days), events scheduled for the 31st will not execute
  - Node.js scheduler does not support "last day of month" functionality
  - Events only trigger on valid date combinations

## Device and Tag Relationship

### Device Binding

Each schedule is bound to a specific device and controls its associated tag:

- **Device Selection**: Choose from available devices in your project
- **Tag Control**: Scheduler directly controls the device's primary tag
- **Master Authority**: Scheduler always takes precedence over manual tag changes

### Device Actions

In addition to controlling the primary device tag, you can configure additional actions:

- **Set Value**: Set other device tags to specific values
- **Run Script**: Execute custom JavaScript functions
- **Trigger Points**: Actions execute on both start and end events

Device actions are configured in the scheduler properties and provide extended automation capabilities beyond basic on/off control.

## Authorization

The Scheduler implements a two-tier authorization system:

### Master Authorization
- **Automatic Assignment**: Scheduled devices automatically receive master authorization level
- **Minimum Requirement**: Users must have at least master authorization to interact with scheduled devices
- **Override Capability**: Master auth allows the scheduler to override manual tag changes during active events

### Per-Device Authorization
- **Additional Security**: Individual devices can have higher authorization levels beyond the master requirement
- **Granular Control**: Different devices can require different permission levels (e.g., critical equipment may need admin access)
- **Layered Security**: Master auth provides base access, while per-device auth adds device-specific restrictions

## Add/Edit Schedule Form

### Basic Settings

- **Device**: Select the target device to control
- **Start Time**: When the event should begin (HH:MM format)
- **Mode Toggle**: Switch between Timer Mode and Event Mode

### Timer Mode vs Event Mode

#### Timer Mode
- **End Time**: Define when the event should stop
- **Tag Behavior**: Tag remains ON from start time to end time
- **Use Case**: Regular on/off periods (e.g., 8:00 AM to 6:00 PM)

#### Event Mode
- **Duration**: Set how long the event should last
- **Duration Units**: Hours, minutes, seconds
- **Tag Behavior**: Tag goes ON for the specified duration, then automatically OFF
- **Use Case**: Timed triggers (e.g., run pump for 30 seconds)

### Recurring vs One-Time Events

- **Recurring**: Event repeats according to schedule (default)
- **One-Time**: Event executes once and is automatically removed
- **Auto-Cleanup**: Non-recurring events are deleted after completion

### Month Mode Configuration

When Month Mode is enabled:

- **Month Selection**: Choose which months the event should run
- **Day-of-Month Selection**: Select specific dates within those months
- **Calendar View**: Click the calendar button to see a visual representation of your schedule

## Data Storage

### Database Structure

Schedules are stored in the project database with the following structure:

```json
{
  "schedules": {
    "Device Name": [
      {
        "id": "unique_schedule_id",
        "startTime": "08:00",
        "endTime": "18:00",
        "days": [false, true, true, true, true, true, false],
        "months": [false, false, false, false, false, false, false, false, false, true, false, false],
        "daysOfMonth": [false, false, false, false, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        "monthMode": true,
        "recurring": true,
        "eventMode": false,
        "duration": 0,
        "deviceName": "Device Name",
        "variableId": "tag_id"
      }
    ]
  },
  "settings": {
    "deviceActions": [...]
  }
}
```

### Key Fields

- **days**: Boolean array for Monday-Sunday (7 elements)
- **months**: Boolean array for January-December (12 elements)
- **daysOfMonth**: Boolean array for 1st-31st (31 elements)
- **monthMode**: Enables month-based scheduling when true
- **eventMode**: Enables duration-based events when true
- **recurring**: Controls whether event repeats or executes once

## Usage Examples

### Daily Pump Schedule
- Device: Water Pump
- Days: Monday-Friday
- Start: 08:00, End: 18:00
- Mode: Timer Mode
- Result: Pump runs during business hours on weekdays

### Monthly Maintenance
- Device: Maintenance Valve
- Months: January, April, July, October
- Days: 15th of each month
- Start: 09:00, Duration: 2 hours
- Mode: Event Mode, Non-recurring
- Result: Valve opens for maintenance on quarterly schedule

### Holiday Lighting
- Device: Holiday Lights
- Months: December
- Days: 1st through 31st
- Start: 17:00, End: 23:00
- Mode: Timer Mode
- Result: Lights run every evening in December

## Best Practices

1. **Test Schedules**: Always test new schedules during development
2. **Month Limitations**: Avoid scheduling for invalid date combinations
3. **Device Actions**: Use device actions for complex automation logic
4. **Time Zones**: Be aware of server time zone for scheduling
5. **Resource Management**: Non-recurring events auto-cleanup to prevent accumulation

## Troubleshooting

### Common Issues

- **Event Not Triggering**: Check month/day combinations for validity
- **Tag Not Changing**: Verify device connection and permissions
- **Actions Not Executing**: Check device action configuration
- **Schedule Not Saving**: Ensure proper permissions and database access

### Debug Information

Scheduler logs include detailed information about:
- Schedule loading and parsing
- Event triggering with timestamps
- Tag write operations
- Device action execution
- Month mode date validation