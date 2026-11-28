# IoTDB DAQ Storage

FUXA can store historical DAQ values in Apache IoTDB using the Tree model and the official Node.js session client. Configure the backend in **Application Settings > DAQ store**.

| Setting | Default | Meaning |
| --- | --- | --- |
| Host | `127.0.0.1` | IoTDB DataNode RPC address |
| Port | `6667` | IoTDB DataNode RPC port |
| Tree database path | `root.fuxa` | IoTDB database path; it must be below `root` |
| Username | `root` | IoTDB session user |
| Password | `root` | IoTDB session password |

Each FUXA device maps to a hexadecimal-encoded device node below the configured database path. Each DAQ tag maps to a hexadecimal-encoded measurement below that device. Numeric values use `DOUBLE`, booleans use `BOOLEAN`, text uses `TEXT`, and buffers use `BLOB`. Buffer bytes are stored as Base64 bytes inside the IoTDB BLOB so the Node.js session client's text-decoded BLOB results can be restored without losing arbitrary byte values. The adapter creates the database and timeseries as needed, then batches each device update with the official session client's tablet API. It reads matching tag measurements across devices and returns millisecond timestamps to FUXA. The IoTDB server must use millisecond timestamp precision, which is the default.

IoTDB timeseries have a fixed data type. A tag that changes between numeric, boolean, text, or binary values after its timeseries is created cannot be written to that existing measurement; use a new FUXA tag ID or migrate the IoTDB schema. The existing FUXA retention setting is not applied to IoTDB by this backend.

The real-server smoke test writes uniquely named data and leaves its database in place as evidence:

```sh
IOTDB_HOST=127.0.0.1 IOTDB_PORT=6667 IOTDB_USERNAME=root IOTDB_PASSWORD=root node scripts/iotdb-storage-smoke.js
```
