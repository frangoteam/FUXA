# FUXA 设置与数据库架构说明文档

本文档详细介绍了 FUXA 项目的配置参数以及数据库表格结构，旨在帮助开发者和运维人员更好地理解和管理系统。

---

## 一、 系统设置 (settings.js)

FUXA 的核心设置文件位置取决于运行模式：
*   **Standalone (独立运行)**: 通常位于 `server/_appdata/settings.js`。
*   **Electron App**: 每个项目有独立的设置，位于 `[项目目录]/data/_appdata/settings.js`。

### 1. 基础配置
*   **`uiPort`**: Web 服务器监听的 TCP 端口，默认为 `1881`。
*   **`language`**: 编辑器的默认语言，默认为 `en` (英语)。
*   **`logDir`**: 日志文件的存储目录，默认为 `_logs`。
*   **`logApiLevel`**: HTTP 请求日志的详细程度。可选值：`dev`, `combined`, `common`, `short`, `tiny`, `none`。
*   **`dbDir`**: 运行时数据库（如 DAQ 数据）的存储目录，默认为 `_db`。

### 2. 数据采集与分发
*   **`daqEnabled`**: 是否启用数据采集 (DAQ)，默认为 `true`。
*   **`daqTokenizer`**: DAQ 数据库文件的切换周期（单位：小时），默认为 `24`。设为 `0` 则不切换，仅使用一个文件。
*   **`broadcastAll`**: 
    *   `false` (默认): 仅将当前视图绑定的变量值推送到前端。
    *   `true`: 将所有配置的变量值推送到前端。

### 3. 网络与安全
*   **`uiHost`**: 绑定的主机地址。默认为 `0.0.0.0`（接受所有接口连接）。
*   **`allowedOrigins`**: 允许跨域请求 (CORS) 的源列表。
*   **`secureEnabled`**: 是否启用安全认证（登录、权限控制）。
*   **`secretCode`**: 用于 JWT 令牌加密的密钥。
*   **`tokenExpiresIn`**: 令牌过期时间，例如 `'1h'` (1小时), `'1d'` (1天)。

### 4. 其他功能
*   **`swaggerEnabled`**: 是否启用 Swagger API 文档（开发调试用）。
*   **`nodeRedEnabled`**: 是否启用集成 Node-RED 流程引擎。
*   **`webcamSnapShotsDir`**: 摄像头抓拍图片的存储目录。

---

## 二、 Electron 桌面应用运行模式说明

当使用 FUXA 作为 Electron 桌面应用运行时，文件存储结构与 Standalone 模式有所不同，具有“多项目管理”的特性。

### 1. 软件全局配置 (Config)
存储 Electron 应用本身的配置（如最近打开的项目列表、自启动设置、全屏/右键菜单开关等）。
*   **Windows**: `%APPDATA%/fuxa-app/config.json`
*   **Linux**: `~/.local/share/fuxa-app/config.json`
*   **macOS**: `~/Library/Application Support/fuxa-app/config.json`

### 2. 项目数据结构
在 Electron 模式下，您可以创建多个项目文件夹，每个项目的结构如下：
*   **项目根目录**: 您在创建项目时选择的文件夹。
    *   **`data/`**: 项目的核心数据根目录。
        *   **`_appdata/`**: 存储配置和数据库。
            *   `settings.js`: 该项目的独立系统设置。
            *   `project.fuxap.db`: 该项目的工程配置文件（视图、设备等）。
            *   `users.fuxap.db`: 该项目的用户信息数据库。
        *   **`_db/`**: 历史数据目录。
            *   `daq-data_*.db`: 历史趋势数据。
        *   **`_logs/`**: 该项目的运行日志。

---

## 三、 数据库架构 (project.fuxap.db)

FUXA 使用 SQLite 数据库存储工程配置信息。文件位置：
*   **Standalone**: `server/_appdata/project.fuxap.db`
*   **Electron**: `[项目目录]/data/_appdata/project.fuxap.db`

### 1. `general` (通用配置表)
存储工程的全局属性。
*   **`name`**: 配置项名称 (如 `version`, `layout`, `charts`, `languages`)。
*   **`value`**: 配置内容的 JSON 字符串。

### 2. `views` (视图表)
存储 HMI 编辑器中创建的所有画面（视图）。
*   **`name`**: 视图 ID (`v_` 开头)。
*   **`value`**: 包含 SVG 内容、控件配置、动画等的 JSON 字符串。

### 3. `devices` (设备表)
存储通信驱动配置（如 PLC, Modbus, MQTT, OPC UA 等）。
*   **`name`**: 设备 ID 或 `'server'` (服务端虚拟设备)。
*   **`value`**: 包含设备连接参数和变量 (Tags) 定义的 JSON 字符串。

### 4. `texts` (多语言文本表)
存储工程中自定义的多语言文本翻译。
*   **`name`**: 文本标识名。
*   **`value`**: 包含各语种对应值的 JSON 字符串。

### 5. `alarms` (报警配置表)
存储报警条件的定义。
*   **`name`**: 报警名称。
*   **`value`**: 包含报警触发条件、严重程度、动作等的 JSON 字符串。

### 6. `notifications` (通知表)
存储系统通知（如邮件、短信）的配置。
*   **`name`**: 通知 ID。
*   **`value`**: 包含接收者、触发模式等的 JSON 字符串。

### 7. `scripts` (脚本表)
存储工程中编写的 JavaScript 脚本。
*   **`name`**: 脚本 ID。
*   **`value`**: 脚本代码及执行参数。

### 8. `reports` (报表表)
存储自动生成报表的模板和计划。
*   **`name`**: 报表 ID。
*   **`value`**: 报表定义 JSON。

### 9. `locations` (位置/地图表)
存储地理信息或位置标记相关的配置。
*   **`name`**: 位置 ID。
*   **`value`**: 经纬度及关联数据。

---

## 四、 其他运行时数据库

*   **`users.fuxap.db`**: 存储用户信息、角色及权限。
*   **`alarms.fuxap.db`**: 存储报警的历史记录。
*   **`daq-data_*.db`**: 在 `_db` 目录下，存储历史趋势数据（变量值随时间的变化）。
*   **`currentTagReadings.db`**: 存储变量的当前最新实时值，用于系统崩溃后恢复状态。
