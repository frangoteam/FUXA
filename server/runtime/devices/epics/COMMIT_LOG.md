# Git Commit Summary: EPICS Driver Implementation & Optimization

## 0. About EPICS
**EPICS (Experimental Physics and Industrial Control System)** is a set of open-source software tools, libraries and applications developed collaboratively and used worldwide to create distributed soft real-time control systems for scientific instruments such as particle accelerators, telescopes and other large-scale experimental facilities. 

In the context of FUXA, this driver enables seamless integration with EPICS Input/Output Controllers (IOCs) via the **Channel Access (CA)** protocol, allowing FUXA to act as a powerful web-based HMI/SCADA for complex scientific and industrial environments.

This document summarizes the changes staged for commit to support the EPICS protocol within the FUXA project.

## 1. Core Changes Summary
Implemented a comprehensive, robust EPICS driver using a high-performance native bridge. This update covers the entire stack from low-level native calls to the frontend configuration UI.

## 2. Detailed Scope of Changes

### Backend (Server)
- **Native Interface (`server/runtime/devices/epics/cainterface.js`)**:
    - Integrated **Koffi** for efficient native calling of `ca.dll`, replacing legacy FFI implementations.
    - Optimized `_decodeValue` logic to handle single-value Process Variables (PVs), fixing the issue where readbacks were incorrectly displayed as `[object ArrayBuffer]`.
    - Added automatic type coercion in `put()` to ensure string values from the UI are correctly converted to numeric EPICS types.
    - Hardened resource lifecycle management (`destroy()`) to prevent server crashes during project reloads or driver restarts.
- **Driver Main Logic (`server/runtime/devices/epics/index.js`)**:
    - Implemented PV polling and real-time monitoring (Subscription) mechanisms.
    - Added batching and throttling to manage concurrent read/write operations.
- **Integration**:
    - Registered the EPICS plugin in the runtime engine.
    - Updated `server/package.json` with `koffi` and adjusted dependencies for better stability.

### Frontend (Client)
- **Configuration UI**:
    - Created `tag-property-edit-epics` component for managing PV addresses, data types, and monitoring modes.
- **Device Management**:
    - Updated device list and property components to support EPICS device types.
- **Internationalization**:
    - Added EPICS-related translation keys to `zh-cn.json` and other assets.

### Desktop (Electron)
- **Pathing Fixes (`app/electron/main.js`)**:
    - Refactored `getServerPath()` to correctly resolve the server entry point within the packaged `resources` directory.
- **Packaging Configuration (`app/electron/package.json`)**:
    - Enabled `asar` with `asarUnpack` for `koffi` and `node-epics-ca` to ensure native binaries (.dll) are physically available for OS loading.
    - Corrected `extraResources` mapping to include necessary server dependencies and client assets.

## 3. Resolved Issues
- **Fixed**: Server crash (segmentation fault) during project save or reload.
- **Fixed**: PV readback values displaying as `[object ArrayBuffer]`.
- **Fixed**: `TypeError` when writing numeric values provided as strings.
- **Fixed**: Packaged Electron app failing to locate the server or native modules.

---


