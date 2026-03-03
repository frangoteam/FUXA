WebSocket is a great simple way to communicate with other web applications such as Node-Red. We can use WebSocket directly in Fuxa Scripts.

Here is an example of bidirectional data transfer, we wrap all Fuxa tags and values into a JSON Data object with a Timestamp and Payload. We use a for loop to grab all the tag values and insert into the Payload and we also use a for loop to write tags values received from the WebSocket.

The Script has to be a Server side script and set for on Startup. You have to have a already running WebSocket Server as the below code is for WebSocket Client. 

It is possible to also create a WebSocket Server in the Fuxa Script if needed. The below code only covers client connection to a server. 

```
const WebSocket = require('/usr/src/app/FUXA/server/node_modules/ws');
let ws;  // Declare ws Web Socket globally to manage the connection

const WebSocketUrl = 'ws://127.0.0.1:1880'; // Url to WebSocket Server

// List of PLC/FUXA Tags
const tagNames = [
    'yourTagName1', 
    'yourTagName2', 
    'yourTagName3', 
    'yourTagName4', 
    'yourTagName5'
];

// Function to get tag values and create the JSON payload
async function createPayload() {
    let payload = {};

    for (const tagName of tagNames) {
        let tag = await $getTag($getTagId(tagName));
        payload[tagName] = tag;
    }

    return {
        data: {
            timestamp: new Date().toISOString(),
            payload: payload
        }
    };
}

// Function to send data to WebSocket server
function sendData() {
    createPayload().then((payload) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(payload));
        } else {
            //console.log('WebSocket is not open. Skipping sending data.');
        }
    });
}

// Open WebSocket connection
function openWebSocketConnection() {
    ws = new WebSocket(WebSocketUrl);

    ws.on('open', () => {
        console.log('WebSocket connection established');
    });

    ws.on('message', (message) => {
        try {
            let receivedData = JSON.parse(message);
            if (receivedData.data && receivedData.data.payload) {
                for (const tagName in receivedData.data.payload) {
                    if (tagNames.includes(tagName)) {
                        $setTag($getTagId(tagName), receivedData.data.payload[tagName]);
                    }
                }
            }
        } catch (error) {
            console.error('Error parsing message from WebSocket server:', error);
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });

    ws.on('close', () => {
        console.log('WebSocket connection closed');
        // Attempt to reconnect after a delay if the connection is closed
        setTimeout(openWebSocketConnection, 5000); 
    });
}

// Start the WebSocket connection
openWebSocketConnection();

// Set interval to send data every 500ms
if (typeof globalThis.myTimer === 'undefined') globalThis.myTimer = null;

if (!globalThis.myTimer) globalThis.myTimer = setInterval(myTimerFunction, 500);

async function myTimerFunction() {
  sendData();
}
``` 