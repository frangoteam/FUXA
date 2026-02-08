# HowTo Node-RED Integration

## Overview

FUXA includes full Node-RED integration, allowing you to create powerful automation flows that interact with your SCADA system.

## Setup and Installation

### Node-RED in FUXA
Node-RED is automatically included with FUXA and requires no additional installation. Access it through the FUXA settings menu.

### Installing Dashboard 2
Dashboard 2 must be installed separately if needed:

1. Open Node-RED editor (via FUXA settings)
2. Click the menu (☰) → **Manage Palette**
3. Search for: `@flowfuse/node-red-dashboard`
4. Click **Install**
5. Restart Node-RED/FUXA

### Required Dependencies
- **@flowfuse/node-red-dashboard**: For modern dashboard creation
- **node-red-contrib-fuxa**: Automatically included (provides FUXA integration nodes)

### Configuration
No additional configuration is required. Node-RED automatically connects to FUXA's runtime environment.

### Security and Access Mode
Node-RED access can be configured when FUXA security is enabled.

**Setting**: `nodeRedAuthMode`

- `secure` (default): Node-RED editor and admin APIs require authentication (JWT or API key).
- `legacy-open`: Node-RED remains open (no auth) to preserve legacy behavior.

**Notes**:
- Changes apply after server restart.
- If `secureEnabled=true` and `nodeRedAuthMode=secure`, external systems can access Node-RED HTTP endpoints using an API key header:
  `x-api-key: <api-key>`
  API keys are managed in FUXA under **Editor → Setup → API Keys**.

## Accessing Node-RED

### Node-RED Editor
Access the Node-RED flow editor through the FUXA settings:

1. Click the **Settings** button in FUXA
2. Navigate to **Node-RED** section
3. Click **Open Node-RED Editor**

This opens the Node-RED flow editor in a new window/tab.

### Dashboard 2
**Note**: Dashboard 2 is not installed by default and must be installed separately.

#### Installation
1. In Node-RED, go to **Menu → Manage Palette**
2. Search for and install: `@flowfuse/node-red-dashboard`
3. Restart Node-RED/FUXA

#### Accessing Dashboard 2
Once installed, view your Node-RED dashboards:

**Embedded in FUXA Views**: Add an iframe component to any FUXA view

#### Embedding Dashboard in FUXA View

1. Open your FUXA project in the editor
2. Add an iframe component to your view
3. Set the URL to: `/dashboard`
4. Configure the iframe size and properties as needed
5. If you only want to display a single page you can adjust dashboard settings and use `/dashboard/page1` or the name of your page

**Important**: Dashboard 2 must be installed before attempting to access `/dashboard`

## FUXA Contrib Nodes

The FUXA contrib package provides specialized nodes for SCADA integration, this package is designed to only work with the FUXA Node-Red Integration and will not work in a standalone Node-Red installation

### Tags Nodes

#### get-tag
**Purpose**: Retrieve the current value of a FUXA tag

**Parameters**:
- **Name**: Optional node name for identification
- **Tag**: Tag name (dropdown populated from FUXA devices)

**Input**: Any message (triggers tag read)
**Output**: `msg.payload` contains the tag value

**Example Output**:
```json
{
  "payload": 25.3,
  "_msgid": "abc123"
}
```

#### set-tag
**Purpose**: Write a value to a FUXA tag

**Parameters**:
- **Name**: Optional node name for identification
- **Tag**: Tag name (dropdown populated from FUXA devices)

**Input**: `msg.payload` contains the value to write
**Output**: `msg.payload` contains the written value

**Example Input**:
```json
{
  "payload": 50.0
}
```

#### get-tag-change
**Purpose**: Monitor a FUXA tag for value changes based on device polling events

**Parameters**:
- **Name**: Optional node name for identification
- **Tag**: Tag name (dropdown populated from FUXA devices)

**Input**: None (event-driven)
**Output**: `msg.payload` contains the new tag value when it changes

**How it works**: This node subscribes to FUXA's device polling events. When devices are polled and a tag value has changed since the last poll, the node outputs a message with the new value. The timing depends on the device's polling interval (typically 1-5 seconds).

**Example Output**:
```json
{
  "payload": 25.3,
  "topic": "temperature",
  "tagId": "device1.temperature",
  "tagName": "temperature",
  "timestamp": "2025-01-01T10:30:00.000Z",
  "previousValue": 24.8
}
```

**Note**: This node only outputs messages when tag values actually change, not on every polling cycle. It efficiently monitors for changes without requiring manual polling.

#### get-tag-id
**Purpose**: Get the internal ID of a tag by name

**Parameters**:
- **Name**: Optional node name for identification
- **Tag**: Tag name (dropdown populated from FUXA devices)

**Input**: Any message
**Output**: `msg.payload` contains the tag ID

#### get-historical-tags
**Purpose**: Retrieve historical tag data for multiple tags simultaneously

**Parameters**:
- **Name**: Optional node name for identification
- **Tags**: Comma-separated list of tag names (e.g., "temp1,temp2,pressure")
- **From Time**: Start of historical period (datetime-local picker)
- **To Time**: End of historical period (datetime-local picker)

**Input**: Any message or override with `msg.tags`, `msg.from`, `msg.to`
**Output**: `msg.payload` contains historical data array

**Multiple Tags Support**:
- Enter tags as comma-separated values: `temp1,temp2,pressure`
- Each tag's historical data is retrieved for the same time period
- Results are combined in a single response

**Example Input** (comma-separated):
```json
{
  "tags": "temp1,temp2,pressure",
  "from": "2025-01-01T08:00",
  "to": "2025-01-01T17:00"
}
```

**Example Input** (array):
```json
{
  "tags": ["temp1", "temp2", "pressure"],
  "from": "2025-01-01T08:00",
  "to": "2025-01-01T17:00"
}
```

**Example Output**:
```json
{
  "payload": [
    {
      "tag": "temp1",
      "data": [
        {"timestamp": "2025-01-01T08:00:00Z", "value": 25.3},
        {"timestamp": "2025-01-01T09:00:00Z", "value": 26.1}
      ]
    },
    {
      "tag": "temp2", 
      "data": [
        {"timestamp": "2025-01-01T08:00:00Z", "value": 24.8},
        {"timestamp": "2025-01-01T09:00:00Z", "value": 25.2}
      ]
    }
  ]
}
```

#### get-tag-daq-settings
**Purpose**: Get DAQ (Data Acquisition) settings for a tag

**Parameters**:
- **Name**: Optional node name for identification
- **Tag**: Tag name (dropdown populated from FUXA devices)

**Input**: Any message
**Output**: `msg.payload` contains DAQ settings object

#### set-tag-daq-settings
**Purpose**: Configure DAQ (Data Acquisition) settings for a tag

**Parameters**:
- **Name**: Optional node name for identification
- **Tag**: Tag name (dropdown populated from FUXA devices)
- **Enabled**: Checkbox to enable/disable DAQ for this tag
- **Interval**: Sampling interval in milliseconds
- **Deadband**: Minimum change threshold for data updates

**Input**: Any message or override with `msg.tag`, `msg.enabled`, `msg.interval`, `msg.deadband`
**Output**: `msg.payload` contains updated settings

**DAQ Settings**:
- **Enabled**: Turn data acquisition on/off for this tag
- **Interval**: How often to sample the tag (in milliseconds)
- **Deadband**: Only report changes greater than this threshold (prevents noise)

### Devices Nodes

#### enable-device
**Purpose**: Enable or disable a device connection

**Parameters**:
- **Name**: Optional node name for identification
- **Device Name**: Device name (dropdown populated from FUXA devices)
- **Enabled**: Checkbox to enable/disable the device

**Input**: Any message or override with `msg.deviceName`, `msg.enabled`
**Output**: `msg.payload` contains operation result

**Enable/Disable**: Check the box to enable device, uncheck to disablenterface for connecting devices, processing data, and controlling your industrial processes.

#### get-device
**Purpose**: Get information about a FUXA device

**Parameters**:
- **Name**: Optional node name for identification
- **Device Name**: Device name (dropdown populated from FUXA devices)
- **Include Tags**: Checkbox to include tag information in the response

**Input**: Any message or override with `msg.deviceName`, `msg.includeTags`
**Output**: `msg.payload` contains device information object

**Include Tags**: When checked, the response includes all tags associated with the device

#### enable-device
**Purpose**: Enable or disable a device connection

**Parameters**:
- **Name**: Optional node name for identification
- **Device**: Device name (dropdown populated from FUXA devices)
- **Enable**: Checkbox to enable/disable

**Input**: Any message or override with `msg.enable`
**Output**: `msg.payload` contains operation result

#### get-device-property
**Purpose**: Get a property value from a device

**Parameters**:
- **Name**: Optional node name for identification
- **Device Name**: Device name (dropdown populated from FUXA devices)
- **Property**: Property name to retrieve

**Input**: Any message or override with `msg.deviceName`, `msg.property`
**Output**: `msg.payload` contains property value

**Property Names**: Common properties include "status", "connected", "lastError", etc.

#### set-device-property
**Purpose**: Set a property value on a device

**Parameters**:
- **Name**: Optional node name for identification
- **Device Name**: Device name (dropdown populated from FUXA devices)
- **Property**: Property name to set
- **Value**: Value to set for the property

**Input**: `msg.payload` contains the value or override with `msg.deviceName`, `msg.property`, `msg.value`
**Output**: `msg.payload` contains the set value

### Alarms Nodes

#### get-alarms
**Purpose**: Get current active alarms

**Parameters**:
- **Name**: Optional node name for identification

**Input**: Any message
**Output**: `msg.payload` contains array of active alarms

**Example Output**:
```json
{
  "payload": [
    {
      "id": "alarm1",
      "name": "High Temperature",
      "status": "active",
      "timestamp": "2025-01-01T10:30:00Z",
      "value": 85.5
    }
  ]
}
```

#### get-history-alarms
**Purpose**: Get historical alarm data

**Parameters**:
- **Name**: Optional node name for identification
- **Start Time**: Start of historical period (datetime-local picker)
- **End Time**: End of historical period (datetime-local picker)

**Input**: Any message or override with `msg.startTime` and `msg.endTime`
**Output**: `msg.payload` contains historical alarms array

#### ack-alarm
**Purpose**: Acknowledge alarms in FUXA

**Parameters**:
- **Name**: Optional node name for identification
- **Alarm Name**: Alarm name (dropdown populated from FUXA alarms)
- **Types**: Comma-separated alarm types (optional)

**Input**: Any message or override with `msg.alarmName`, `msg.types`
**Output**: `msg.payload` contains acknowledgment result

**Alarm Types**: Specify alarm types to acknowledge specific alarm categories (comma-separated: "warning,error,critical")

### Views Nodes

#### set-view
**Purpose**: Change the current view in FUXA

**Parameters**:
- **Name**: Optional node name for identification
- **View Name**: View name (dropdown populated from FUXA views)

**Input**: Any message or override with `msg.viewName`
**Output**: `msg.payload` contains operation result

#### open-card
**Purpose**: Open a specific card/dialog in FUXA

**Parameters**:
- **Name**: Optional node name for identification
- **Card**: Card name (dropdown populated from FUXA cards)

**Input**: Any message or override with `msg.cardName`
**Output**: `msg.payload` contains operation result

### Scripts Nodes

#### execute-script
**Purpose**: Execute a FUXA script

**Parameters**:
- **Name**: Optional node name for identification
- **Script**: Script name (dropdown populated from FUXA scripts)

**Input**: Any message or override with `msg.scriptName`
**Output**: `msg.payload` contains execution result

**Example Output**:
```json
{
  "payload": {
    "success": true,
    "script": "myScript",
    "result": "Script completed successfully",
    "timestamp": "2025-01-01T10:45:00Z"
  }
}
```

### DAQ Nodes

#### get-daq
**Purpose**: Get Data Acquisition (DAQ) data for a single tag

**Parameters**:
- **Name**: Optional node name for identification
- **Tag**: Single tag name (dropdown populated from FUXA devices)
- **From Time**: Start of DAQ period (datetime-local picker)
- **To Time**: End of DAQ period (datetime-local picker)

**Input**: Any message or override with `msg.from`, `msg.to`
**Output**: `msg.payload` contains DAQ data for the single tag

**Single Tag Only**: Unlike get-historical-tags, this node only processes one tag at a time. For multiple tags, use separate get-daq nodes or get-historical-tags.

**Example Output**:
```json
{
  "payload": [
    {"timestamp": "2025-01-01T10:00:00Z", "value": 25.3, "quality": "good"},
    {"timestamp": "2025-01-01T10:01:00Z", "value": 25.8, "quality": "good"}
  ]
}
```

### Events Nodes

#### emit-event
**Purpose**: Emit custom events through FUXA's event system for inter-system communication and automation triggering

**Parameters**:
- **Name**: Optional node name for identification
- **Event Type**: Custom event name/type (e.g., "machine-fault", "production-complete", "maintenance-required")

**Input**: `msg.payload` contains the event data (any format: string, number, object, array)
**Output**: `msg.payload` unchanged (passes through)

**Event Types and Usage**:

**System Events** (built-in FUXA events):
- `device-status` - Device connection status changes
- `device-property` - Device property updates
- `device-values` - Tag value changes
- `alarms-status` - Alarm state changes
- `script-console` - Script console output
- `heartbeat` - System heartbeat/alive signals

**Custom Events** (user-defined):
- `production-start` - Production line started
- `production-stop` - Production line stopped
- `quality-alert` - Quality control alert
- `maintenance-due` - Equipment maintenance required
- `operator-login` - Operator authentication
- `batch-complete` - Production batch finished

**Event Data Examples**:

**Simple string event**:
```json
{
  "payload": "Machine fault detected"
}
```

**Structured event data**:
```json
{
  "payload": {
    "eventType": "production-alert",
    "machine": "Line-A",
    "severity": "high",
    "timestamp": "2025-01-01T10:30:00Z",
    "details": {
      "temperature": 85.5,
      "pressure": 2.1,
      "errorCode": "E-202"
    }
  }
}
```

**Array data event**:
```json
{
  "payload": [
    {"sensor": "temp1", "value": 75.2},
    {"sensor": "temp2", "value": 76.8},
    {"sensor": "temp3", "value": 74.9}
  ]
}
```

**How Events Work**:
1. Events are emitted to FUXA's internal event system
2. Other FUXA components can listen for these events
3. Events can trigger scripts, update displays, or initiate automation sequences
4. Events persist until consumed or the system restarts

**Common Use Cases**:
- **Machine Monitoring**: Emit events when equipment enters fault states
- **Production Tracking**: Signal production milestones or quality issues
- **Maintenance Alerts**: Notify when equipment needs servicing
- **Operator Notifications**: Alert operators to system conditions
- **Data Integration**: Send structured data to external systems

**Integration with Scripts**:
Events can be consumed by FUXA scripts using the event system. Scripts can listen for specific event types and execute automated responses.

#### send-message
**Purpose**: Send email notifications or messages through FUXA's notification system

**Parameters**:
- **Name**: Optional node name for identification
- **Address**: Recipient email address
- **Subject**: Email subject line
- **Message**: Default message content (can be overridden)

**Input**: `msg.payload` can contain message data or override with `msg.address`, `msg.subject`, `msg.message`
**Output**: `msg.payload` contains send result

**Message Format Options**:

**Simple text message** (uses configured address/subject):
```json
{
  "payload": "Alert: Temperature exceeded threshold"
}
```

**Complete message override**:
```json
{
  "address": "operator@company.com",
  "subject": "Production Alert",
  "message": "Line A has stopped due to maintenance requirement"
}
```

**Multiple recipients**:
```json
{
  "address": ["operator1@company.com", "supervisor@company.com"],
  "subject": "Quality Control Alert",
  "message": "Batch #1234 failed quality inspection"
}
```

## Data Formats

### Tag Values
Tag values can be:
- **Numbers**: `25.3`, `100`, `0`
- **Strings**: `"Running"`, `"Stopped"`
- **Booleans**: `true`, `false`
- **Objects**: Complex data structures

### Timestamps
All timestamps use ISO 8601 format:
```json
"2025-01-01T10:30:00.000Z"
```

### Error Handling
All nodes output errors to the debug tab. Common error patterns:
```json
{
  "payload": null,
  "_msgid": "abc123",
  "error": "Tag not found: myTag"
}
```

## Troubleshooting

### Dashboard Not Loading
**Problem**: `/dashboard` shows error or blank page

**Solution**: Install Dashboard 2
1. Open Node-RED editor
2. Go to **Manage Palette**
3. Install `@flowfuse/node-red-dashboard`
4. Restart Node-RED/FUXA

### FUXA Nodes Not Appearing
**Problem**: FUXA contrib nodes not visible in palette

**Solution**: Check Node-RED logs for errors. The nodes are automatically registered when FUXA starts Node-RED.

### Dropdowns Not Populated
**Problem**: Tag/device dropdowns are empty

**Solution**: Ensure you have devices and tags configured in FUXA. The dropdowns populate from your FUXA project data.

### Events Not Working
**Problem**: Emitted events not triggering expected behavior

**Solution**: Check that other FUXA components (scripts, views) are listening for the correct event types. Events are case-sensitive.

### Email Notifications Not Sending
**Problem**: send-message node not delivering emails

**Solution**: Configure SMTP settings in FUXA server configuration. Check FUXA logs for SMTP connection errors.
