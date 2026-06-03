## Getting started with FUXA

The goal of this tutorial is to demonstrate the basic usage of the most popular FUXA features. You will learn how to:
- Connect devices to FUXA
- Push data from devices to FUXA
- Build a real-time GUI SCADA/HMI/Dashboard
- Define thresholds and trigger alarms

## Prerequisites

You will need to have FUXA server up and running. To install FUXA using [**Installation Guide**](https://github.com/frangoteam/FUXA/wiki/Installing-and-Running).
FUXA UI will be available using the URL: http://localhost:1881.

Principally FUXA web server performs two page: 
- Visualization for end-user http://localhost:1881/home
- Editor to project and design http://localhost:1881/editor

## Step 1. Connect device and configure tags
To connect the device you need to get the device credentials first. FUXA supports various devices: Modbus RTU/TCP, Siemens S7 Protocol, OPC-UA, BACnet IP, MQTT, Ethernet/IP (Allen Bradley). After you connected to a device, you can configure the subscriptions of the live values, Tags, Sensor, etc.
You may find configuration guide by here [**HowTo Devices and Tags**](https://github.com/frangoteam/FUXA/wiki/HowTo-Devices-and-Tags)

## Step 2. Create Visualization
We will create a View and add the most popular widgets. See the instructions below.

   ### Step 2.1 Create Empty View
   [**HowTo create View**](https://github.com/frangoteam/FUXA/wiki/HowTo-View)
   ### Step 2.2 Bind Controls to View
   [**HowTo bind Controls**](https://github.com/frangoteam/FUXA/wiki/HowTo-bind-Controls)
   ### Step 2.3 Bind Shapes to View
   [**HowTo bind Shapes**](https://github.com/frangoteam/FUXA/wiki/HowTo-bind-Shapes)
   ### Step 2.4 Bind Chart Control to View
   [**HowTo chart Control**](https://github.com/frangoteam/FUXA/wiki/HowTo-Chart-Control)

## Step 3. Configure UI Layout
[**HowTo UI Layout**](https://github.com/frangoteam/FUXA/wiki/HowTo-UI-Layout)

## Step 4. Configure Alarms
[**HowTo setup Alarms**](https://github.com/frangoteam/FUXA/wiki/HowTo-setup-Alarms)

## Step 5. Activate and create customer user

## Tips and tricks