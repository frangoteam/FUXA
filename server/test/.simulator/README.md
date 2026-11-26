# Redis scan simulator

A dependency-free Node.js server implementing the small RESP subset needed to test FUXA's Redis key scan (`HELLO`, `CLIENT`, `SCAN`, and `TYPE`). It serves sample string and hash keys and does not require a real Redis installation.

The same directory also contains `snmp-simulator.js`, a local SNMP v1/v2c agent for testing FUXA's SNMP scan. It uses the server's existing `net-snmp` dependency.

## Run

From this directory:

```sh
node redis-simulator.js
```

By default it listens only on `127.0.0.1:6380`. Change the port if Redis is already using its default port:

```sh
node redis-simulator.js --port 6380
```

In FUXA, add a Redis device using the simulator host and port, connect it, open its tag list, and choose **Add → Scan**. The scan returns sample keys such as `plant:boiler:temperature` and `plant:boiler:status`.

To require a password, set `REDIS_PASSWORD` before starting the simulator and configure the same password on the FUXA device. For example, in PowerShell:

```powershell
$env:REDIS_PASSWORD = 'test-password'
node .\redis-simulator.js
```

This is a test-only simulator, not a complete Redis implementation. It is intentionally bound to localhost by default; use `--host 0.0.0.0` only when FUXA runs in another machine/container and the port is appropriately firewalled.

## SNMP simulator

In another terminal, start the agent:

```sh
node snmp-simulator.js
```

It listens on `127.0.0.1:16161`, uses SNMP v2c with community `fuxa-community`, and provides sample OIDs in the default scan subtree `1.3.6.1.2.1`. The device's scan dialog also supports browsing the simulator's private sample subtree `1.3.6.1.4.1.8072.9999`.

In FUXA, create an SNMP device with address `127.0.0.1`, port `16161`, version `v2c`, and the matching community/password `fuxa-community`; then open its tag list and choose **Add → Scan**. Change the port or community with `--port` and `--community` if needed. The simulator binds to localhost by default; use `--host 0.0.0.0` only if FUXA runs in another machine/container and the UDP port is appropriately firewalled.

This simulator supports v1/v2c community access only; it does not simulate SNMPv3 or traps.

## WebAPI tree simulator

`webapi-tree-simulator.cjs` serves a nested JSON response for testing the WebAPI tag browser. It includes prefix-related siblings (`cepn1`/`cepn116` and `lent10`/`lent104`), child values, a deeply nested object, and an array of objects.

From this directory, start it with:

```sh
node webapi-tree-simulator.cjs
```

It listens on port `1888` by default and serves the JSON at `http://localhost:1888/api/tags`. Set `PORT` to use another port, for example in PowerShell:

```powershell
$env:PORT = '1889'
node .\webapi-tree-simulator.cjs
```

Configure a FUXA WebAPI device to use this URL as its GET tags endpoint, then open its tag browser. Expand `Objects` and verify that each prefix-related node shows its own `value` and `status` children. The `nested` branch checks deeper expansion. In `items`, select `name` as the array ID field and `value` as its value field to exercise array mapping. The endpoint can also be checked directly in a browser or with `curl`.

This is a local test fixture, not a production API. The server binds to `0.0.0.0`; if FUXA runs on another machine or in a container, use the simulator host's reachable address and restrict access to the test network. The WebAPI browser preserves response insertion order, so this simulator checks tree display and selection but does not by itself exercise the sorted OPC UA ordering path.

## BACnet object-list simulator

`bacnet-object-list-simulator.js` emulates a BACnet/IP device for FUXA discovery and runtime reads. It advertises a device, provides analog and binary objects with names and present values, and supports `ReadPropertyMultiple` polling. Its sample points include `Temperature` (AI, 22.6), `Pressure` (AI, 4.8), `Temperature Setpoint` (AO, 22.0), and `Pressure Setpoint` (AO, 5.0), plus pump and alarm points. Analog/binary output objects accept writes to `PRESENT_VALUE`. It also simulates a device without segmented responses: a complete `OBJECT_LIST` read aborts with `segmentationNotSupported`, while the array length and individual entries are available by index. The simulator uses the server's bundled `node-bacnet` library.

From this directory, start it with:

```sh
node bacnet-object-list-simulator.js
```

By default it listens on `127.0.0.2:47808`, advertises device ID `321`, and provides 120 analog/binary objects. It uses a distinct loopback address because the bundled BACnet client ignores incoming BACnet services from `127.0.0.1`. Options `--host`, `--port`, `--announce-to`, `--device-id`, and `--objects` customize the simulator; the object count is limited to 10,000. For example:

```sh
node bacnet-object-list-simulator.js --port 47808 --announce-to 127.0.0.1:47809 --device-id 321 --objects 500
```

FUXA requires a non-internal IPv4 interface, so use the computer's LAN IPv4 address rather than `127.0.0.1`. Find it with `node -e "for (const [n, a] of Object.entries(require('os').networkInterfaces())) for (const i of a || []) if (i.family === 'IPv4' && !i.internal) console.log(n, i.address)"`. If that address is `192.168.1.25`, start the simulator with `node bacnet-object-list-simulator.js --host 192.168.1.25 --announce-to 192.168.1.25:47809 --device-id 321 --objects 500`, and set the FUXA BACnet connection address to `192.168.1.25:47809`. Here the address selects FUXA's local interface and port; the simulator sends its I-Am announcements to that endpoint. Then connect and browse device 321; discovery should fall back to indexed reads and show the generated objects. Add discovered objects as tags to exercise runtime polling and present values. If you change FUXA's local port, pass the corresponding destination with `--announce-to`. This test-only simulator binds to a local interface by default; only expose it to a test network when required.
