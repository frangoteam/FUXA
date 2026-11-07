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
