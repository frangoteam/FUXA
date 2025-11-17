# HowTo-Reports

This guide covers FUXA's Advanced PDF Report system, including template creation, data binding, table configurations, and Node-RED integration for automated report generation.

## Overview

FUXA's Advanced Reports use the PDFME library to create dynamic PDF reports with:
- **Template Designer**: Visual drag-and-drop PDF template creation
- **Dynamic Data Binding**: Real-time tag values and historical data
- **Table Support**: Historical data tables and alarm tables
- **Node-RED Integration**: Automated report generation workflows
- **Template Management**: Save, load, and reuse report templates

## Creating Your First Report

### Step 1: Access Advanced Reports

1. Navigate to **Reports** in the main menu
2. Click **Add Report** → **Advanced Report**
3. The Advanced Report Editor opens with the PDFME designer

### Step 2: Design Your Template

The PDFME designer provides:
- **Text Fields**: Drag text elements onto your template
- **Image Elements**: Add logos, charts, or dynamic images
- **Table Elements**: Create data tables (configured separately)
- **Shapes**: Lines, rectangles, circles for layout

### Step 3: Add Dynamic Data Placeholders

Instead of static text, use placeholders that will be replaced with live data:

```
@tag1                    # Basic tag value
@tag1:0.00              # Tag with 2 decimal formatting
@tag1:0.000             # Tag with 3 decimal formatting
@timestamp:YYYY-MM-DD   # Formatted timestamp
```

**Important**: For placeholders to work correctly, ensure the field is **NOT** marked as "Editable" in the designer. Editable fields become input fields instead of displaying tag values.

### Step 4: Configure Report Settings

Click the **wrench icon** (Report Settings) to configure:

#### Basic Settings
- **Report Name**: Display name for the report
- **PDF Settings**:
  - Page Size (A4, A3, Letter, etc.)
  - Orientation (Portrait/Landscape)
  - Custom dimensions (if using custom size)
  - Margins/Padding

#### Data Sources
- **Available Tags**: Select which device tags can be used in this report
- **Global Time Range**: Default time range for historical data tables

## Template Management

### Saving Templates

1. In the Report Settings dialog, click **"Save Template"**
2. Enter a template name
3. Choose whether to overwrite existing templates
4. Templates are saved with thumbnails for easy identification

### Loading Templates

1. Click **"Load Template"** in Report Settings
2. Browse saved templates with preview thumbnails
3. Select and load a template

### Managing Templates

The Template Manager allows you to:
- **View all saved templates** with thumbnails
- **Delete unwanted templates**
- **Organize templates** by name

## Table Configurations

Tables display historical data or alarm information in structured formats.

### Creating a Table

1. Add a **Table element** to your PDF template in the designer
2. Give it a unique name (e.g., `my-table`, `production-data`)
3. In Report Settings, find the table in the **"Table Configurations"** section

### Table Settings

#### Basic Configuration
- **Table Name**: Must match the table element name in your template
- **Time Range**: When to pull historical data
  - **Use Report Time Range**: Use the global report time range
  - **Custom Range**: Set specific from/to dates

#### Column Configuration

Add columns to display different data points:

##### For Historical Data Tables
- **Tag Name**: Select a device tag (e.g., `temperature`, `pressure`)
- **Label**: Column header text (e.g., "Temperature °C")
- **Format**: Number formatting (e.g., `0.00` for 2 decimals)

##### For Alarm Tables
Pre-configured alarm columns:
- **Tag Name**: The alarm tag identifier
- **Type**: Alarm type (High, Low, etc.)
- **Status**: Current alarm status
- **Timestamp**: When the alarm occurred
- **Message**: Alarm description

### Alarm Tables

To create an alarm table:

1. Add a table element named with `alarm-` prefix (e.g., `alarm-table`)
2. In table configuration, check **"Is Alarm Table"**
3. Configure which alarm columns to display
4. Set the time range for alarm history

## Data Binding and Placeholders

### Tag Placeholders

Use `@tagname` syntax to insert live tag values:

```
Temperature: @temperature:0.1 °C
Pressure: @pressure:0.00 bar
Status: @pump_status
```

### Formatting Options

- `@tag:0.00` - 2 decimal places
- `@tag:0.000` - 3 decimal places
- `@tag:0` - No decimals
- `@timestamp:YYYY-MM-DD HH:mm:ss` - Formatted timestamp

### Editable Fields Warning

**Critical**: If a text field in the PDFME designer is marked as "Editable", it becomes an input field instead of displaying tag values. Always ensure placeholder fields are **NOT** editable.

## Node-RED Integration

Use Node-RED to automate report generation with live data.

### Available Nodes

#### 1. Report Data Node
**Purpose**: Format scalar tag values for reports

**Configuration**:
- **Number Format**: Decimal formatting (e.g., `0.00`)

**Input**: Any message with tag values
**Output**: `msg.reportData` object with formatted values

**Example Flow**:
```
[get-tag] → [report-data] → [report-generate]
```

#### 2. Report Table Data Node
**Purpose**: Convert historical data to table format

**Configuration**:
- **Table Name**: Must match template table name
- **Include Timestamp**: Add timestamp column
- **Timestamp Format**: Date/time formatting
- **Number Format**: Decimal precision

**Input**: Historical data from `get-historical-tags`
**Output**: `msg.tableData[tableName]` with formatted table

**Example Flow**:
```
[get-historical-tags] → [report-table-data] → [report-generate]
```

#### 3. Report Generate Node
**Purpose**: Generate the final PDF report

**Configuration**:
- **Report**: Select the advanced report to generate
- **FUXA URL**: Server URL (default: http://localhost:1881)

**Input**: Messages with `reportData` and/or `tableData`
**Output**: Success/failure with file path

### Complete Node-RED Flow Example

```
[trigger] → [get-tag] → [report-data] → [join] → [report-generate] → [email]
                    ↓
          [get-historical-tags] → [report-table-data] → [join]
```

### Join Node Configuration

Use a **Join** node to combine multiple data sources:

- **Mode**: Manual
- **Combine each**: msg.reportData and msg.tableData
- **Send after**: All parts received
- **Parts**: Set to number of input sources

## File Viewer for Reports

Access generated reports through the file explorer:

1. In Report Settings, click **"Browse Files"**
2. Navigate to `_reports/generated/` directory
3. View, download, or delete generated PDFs
4. Files are organized by report name and timestamp

## FUXA Runtime File Viewer Component

For displaying reports and files directly in your HMI interface, use the **HTML File Viewer** gauge component.

### Adding the File Viewer to Your HMI

1. **Open your HMI view** in edit mode
2. **Add a gauge** → **Controls** → **HTML File Viewer**
3. **Configure the component** with these settings:

#### Basic Configuration
- **Directory**: `/_reports/generated` (for reports) or any other directory
- **Header Text**: Display name for the viewer
- **View Enabled**: Allow file viewing
- **Delete Enabled**: Allow file deletion (use with caution)

#### Appearance Settings
- **Accent Color**: Theme color for buttons and highlights
- **Background Color**: Component background
- **Text Color**: Primary text color
- **Border Color**: Component border color

#### Filtering Options
- **File Type Filter**: 
  - `all` - Show all supported files
  - `pdf` - Only PDF files
  - `txt` - Only text files
  - `csv` - Only CSV files
  - `log` - Only log files

- **Date Filter**: Filter files by modification date range

### Runtime Features

The file viewer provides:

#### File List View
- **Search**: Filter files by name
- **Sort Options**: By name or date (ascending/descending)
- **File Information**: Name, size, modification date
- **Supported Formats**: PDF, TXT, CSV, LOG files

#### File Display
- **PDF Viewer**: Embedded PDF display for report files
- **Text Viewer**: Display text-based files
- **Refresh**: Manual refresh of file list
- **Auto-refresh**: Updates when files are generated

#### File Management
- **View Files**: Click to display file content
- **Delete Files**: Remove unwanted files (if enabled)
- **Download**: Save files to local system

### Integration with Report Generation

Perfect for creating operator dashboards:

1. **Add File Viewer** to your main HMI screen
2. **Configure** to show `_reports/generated`
3. **Set up automated report generation** via Node-RED
4. **Operators can immediately view** newly generated reports

### Automated Workflow Example

```
Node-RED Flow: [trigger] → [get data] → [generate report] → [file viewer updates]
HMI Display: File Viewer shows latest report automatically
Operator: Clicks to view PDF without leaving the control interface
```

This creates a seamless workflow where reports are generated in the background and immediately available for viewing in the operator interface.

### Example Use Cases

- **Quality Control Dashboard**: Display inspection reports
- **Production Reports**: Show shift/daily production summaries  
- **Maintenance Logs**: Access equipment maintenance reports
- **Alarm History**: View alarm summary reports

### Security Considerations

- **Permission Levels**: Configure viewer permissions appropriately
- **Delete Permissions**: Be cautious with delete functionality
- **File Access**: Ensure proper server file permissions
- **Network Security**: Consider access controls for sensitive reports

## Advanced Features

### Trigger-Based Generation

Set up automatic report generation:

1. In Report Settings → **Scheduling**
2. Select a **Trigger Tag**
3. Choose trigger condition (rising edge, value change)
4. Reports generate automatically when conditions are met

### Global Time Ranges

Configure default time ranges for all tables in a report:

- **Report Time Range**: Applied to all tables using "Use Report Time Range"
- **Individual Table Ranges**: Override for specific tables

### Template Synchronization

When you modify table configurations, the PDF template automatically updates to match the data structure. This ensures tables display correctly with the right number of columns.

## Troubleshooting

### Common Issues

1. **Placeholders not displaying values**
   - Check if field is marked as "Editable" (uncheck it)
   - Verify tag names match exactly

2. **Tables not showing data**
   - Ensure table name matches template element name
   - Check time range has data available
   - Verify tag permissions

3. **Node-RED generation fails**
   - Check FUXA URL configuration
   - Verify report exists and is configured
   - Check Node-RED logs for errors

4. **Template loading issues**
   - Ensure template was saved properly
   - Check file permissions on template directory

### Data Structure Requirements

**For Report Data Node**:
```javascript
msg.payload = {
  temperature: 25.5,
  pressure: 1013.25,
  status: "running"
}
// Becomes: { temperature: "25.50", pressure: "1013.25", status: "running" }
```

**For Report Table Data Node**:
```javascript
msg.payload = {
  temperature: [
    { x: 1640995200000, y: 25.1 },
    { x: 1640995260000, y: 25.3 }
  ]
}
// Becomes table with timestamp and formatted value columns
```

## Best Practices

1. **Template Naming**: Use descriptive names for templates and tables
2. **Tag Consistency**: Ensure tag names match between flows and reports
3. **Time Ranges**: Test with small ranges first to verify data availability
4. **Formatting**: Use consistent decimal places across similar measurements
5. **Version Control**: Save template versions for complex reports
6. **Testing**: Generate test reports before deploying automated flows

## API Endpoints

For direct API integration:

- `GET /api/advanced-reports` - List reports
- `POST /api/advanced-reports/generate/:id` - Generate report
- `POST /api/advanced-reports/generate-with-data/:id` - Generate with custom data
- `GET /api/advanced-reports/templates` - List saved templates

This comprehensive system allows you to create professional PDF reports with live SCADA data, automated generation, and flexible template management.