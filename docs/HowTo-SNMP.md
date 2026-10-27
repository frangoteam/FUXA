FUXA can read and write the scalar objects of a SNMP agent (v1, v2c or v3) and receive its traps and informs.

**Connection**

Add a Device in **Connections** and select **SNMP**. In the device property set:

- the agent address (IP or host name) and port, default 161
- the SNMP version: `v1`, `v2c` or `v3`, the transport (`udp4`/`udp6`), the request timeout and the retries
- the credentials: the community for v1/v2c, or for v3 the user name, the security level (`noAuthNoPriv`, `authNoPriv`, `authPriv`),
  the authentication protocol (`md5`, `sha`, `sha224`, `sha256`, `sha384`, `sha512`) with its key and the privacy protocol
  (`des`, `aes`, `aes256b`, `aes256r`) with its key, plus an optional context name

The credentials are stored encrypted in the device security store, never in the project file: after importing a project you have to enter them again.
The device is connected when the agent answers a probe of `sysUpTime.0`; for v3 this also validates the credentials.
Since SNMP uses UDP there is no permanent connection: the status follows the answers to the polling and after the
configured *Polls without answer before reconnect* the device reconnects. *OIDs per request* limits the size of each GET datagram.

**Tags**

The Tag address is the numeric OID with instance, for example `1.3.6.1.2.1.1.5.0` (sysName), or a MIB name with module and
instance, for example `SNMPv2-MIB::sysName.0` or `IF-MIB::ifInOctets.3`. The names are resolved on the server: the standard modules
(SNMPv2-MIB, IF-MIB, RFC1213-MIB, ...) are built in, vendor MIB files can be uploaded from the device property (*Upload MIB file*).
They are stored in the `_mibs` directory of the server and loaded when the device is saved or started.

The Tag type selects the encoding of the value for writes (SET) and the conversion of the read value:

| Type | Value in FUXA |
|---|---|
| `Integer`, `Counter32`, `Gauge32`, `Unsigned32`, `TimeTicks` | number |
| `Counter64` | number, precision lost above 2^53 |
| `OctetString`, `IpAddress`, `OID` | string |
| `Hex` | OctetString shown as hexadecimal string, for example MAC addresses |
| `Boolean` | boolean |

Scale, deadband and the read/write scripts of the Tag options work as for the other devices.

**Scan Tags**

With the device connected, the add button of the Tags list offers **Scan Tags**: it walks a subtree of the agent
(default `1.3.6.1.2.1`, mib-2) and lists the OIDs found with the known MIB name, the proposed type and the current value.
The selected OIDs are imported as Tags, named by their MIB name when known.

**Traps and informs**

Enable *Receive traps and informs* in the device property and set the trap port (default 162). On Linux a port below 1024
needs privileges, otherwise configure the agent to send to a port above 1024. One listener per port is shared by all SNMP devices.

Notifications are accepted only from the device address and with the same credentials of the session (community or v3 user).
Each varbind of the notification updates the Tag with the same OID. A Tag with address `1.3.6.1.6.3.1.1.4.1.0` (snmpTrapOID.0)
receives the OID of the last trap, usable to trigger alarms or scripts. For v1 traps `sysUpTime.0` and `snmpTrapOID.0` are built as RFC 3584.
Informs are acknowledged.

Mark the Tags that exist only in the notifications with *Updated only by traps/informs* in the Tag property: they are not polled,
otherwise a GET of a non existing instance would overwrite the value at every polling.

**Notes**

- The DES privacy protocol needs the OpenSSL legacy provider on Node.js 17 and later, prefer AES.
- A malformed uploaded MIB file is reported in the server console, not in the editor.
- Tables (for example ifTable) are read by importing their instances with Scan Tags; the polling groups them in GET requests.
