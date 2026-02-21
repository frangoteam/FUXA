
To add your Device and Tags going to **Connections** in editor.

![](images/setup-connections.png)

Add and connect a **OPCUA** device.
![](images/fuxa-device.gif)

To add OPCUA Tags the device have to be connected.
![](images/fuxa-opcuatag.gif)

To add a **Modbus** connection you have to install the driver in **Plugins**
![](images/fuxa-modbus.gif)

Add a **MQTT** connection and a topic subscription
![](images/fuxa-mqtt.gif)

Add a **WebAPI** connection and a Tag of the JSON result
![](images/fuxa-webapi.gif)

**Tag Options**

If you have any Tag types which don't have a defined data type you can set this. For example TIME data type is no a defined type, but the base data type is normally int64 or uint64 and the time is in milliseconds.

![image](https://github.com/user-attachments/assets/6fbbd718-2ab0-4bac-85dd-8f0339540ca5)

You can also under tag options use the scale script to do any data type conversions etc for example the data from TIME is an array of LOW and HIGH, we can create a simple script to grab the array element and return it as a number type. We can then just return the actual value for write if needed.

![image](https://github.com/user-attachments/assets/3acb42db-bfee-4eed-a385-e8fe264e7ddd)

**Important!** the script parameter must be called value as there is a filter to display relevant scripts for selection. Do not use comments in this script as they are not supported. 

Here is the read script which returns the array element

![image](https://github.com/user-attachments/assets/60b5ce2b-435b-4b18-bc4f-eb73e9fc5bd0)

Here is the write script returning the actual tag value

![image](https://github.com/user-attachments/assets/51cfad3f-9354-45e5-a0a5-206507d1ca93)
 