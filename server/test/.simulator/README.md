# Redis scan simulator

A dependency-free Node.js server implementing the small RESP subset needed to test FUXA's Redis key scan (`HELLO`, `CLIENT`, `SCAN`, and `TYPE`). It serves sample string and hash keys and does not require a real Redis installation.

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
