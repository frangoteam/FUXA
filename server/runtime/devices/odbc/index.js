/**
 * 'odbc': odbc wrapper to communicate with Database 
 */

'use strict';
var odbc;
const utils = require('../../utils');
const deviceUtils = require('../device-utils');
const dateFormatter = require('./date-formatter');

function ODBCclient(_data, _logger, _events) {
    var data = JSON.parse(JSON.stringify(_data)); // Current Device data { id, name, tags, enabled, ... }
    var logger = _logger;
    var lastStatus = '';                    // Last connections status
    var events = _events;                   // Events to commit change to runtime
    this.connection = null;                 // ODBC connection
    this.pool = null;                       // ODBC pool
    var working = false;                    // Working flag to manage overloading polling and connection
    var overloading = 0;                    // Overloading counter to mange the break connection
    var getProperty = null;                 // Function to ask property (security)
    var currentTable = null;                // Current Tablename
    var lastTimestampValue;                 // Last Timestamp of values
    var queryQueue = [];                    // Queue for pending queries

    /**
     * initialize the device type 
     */
    this.init = function (_type) {
        // ODBC device initialization - no special type handling needed
    }

    /**
     * Load device tags (ODBC doesn't use traditional tags)
     */
    this.load = function (_data) {
        return new Promise(function (resolve, reject) {
            // ODBC doesn't have traditional tags to load
            resolve();
        });
    }

    /**
     * Polling (ODBC doesn't poll - it's query-based)
     */
    this.polling = function () {
        // ODBC doesn't poll - it's event-driven via queries
    }

    /**
     * Get all tag values (ODBC doesn't have tags)
     */
    this.getValues = function () {
        return new Promise(function (resolve, reject) {
            // ODBC doesn't have traditional tags
            resolve([]);
        });
    }

    /**
     * Get single tag value (ODBC doesn't have tags)
     */
    this.getValue = function (id) {
        return new Promise(function (resolve, reject) {
            // ODBC doesn't have traditional tags
            resolve({ id: id, value: null, timestamp: new Date() });
        });
    }

    /**
     * Set tag value (ODBC doesn't support setting values)
     */
    this.setValue = function (id, value) {
        return new Promise(function (resolve, reject) {
            // ODBC doesn't support setting values
            reject('ODBC device does not support setting values');
        });
    }

    /**
     * Get device status
     */
    this.getStatus = function () {
        return { id: data.id, status: lastStatus, timestamp: new Date() };
    }

    /**
     * Check if device is connected
     */
    this.isConnected = function () {
        return this.connection !== null;
    }

    /**
     * Bind DAQ (not applicable for ODBC)
     */
    this.bindAddDaq = function (tag) {
        // ODBC doesn't use DAQ binding
    }

    /**
     * Get tag property (not applicable for ODBC)
     */
    this.getTagProperty = function (tag) {
        return null;
    }

    /**
     * Update connection status (callback from device system)
     */
    this.updateConnectionStatus = function (id, status) {
        // ODBC connection status updates are handled internally
    }

    /**
     * Connect to device
     * Emit connection status to clients, clear all Tags values
     */
    this.connect = function () {
        return new Promise(async (resolve, reject) => {
            if (!data.enabled) {
                _emitStatus('connect-off');
                reject();
            } else if (data.property && data.property.address) {
                try {
                    if (_checkWorking(true)) {
                        logger.info(`'${data.name}' try to connect ${data.property.address}`, true);
                        var security
                        await getProperty({query: 'security', name: data.id}).then((result, error) => {
                            if (result) {
                                security = utils.JsonTryToParse(result.value);
                            }
                        });
                        var connectionsString = data.property.address;
                        if (security.uid) {
                            connectionsString += `;UID=${security.uid}`;
                        }
                        if (security.pwd) {
                            connectionsString += `;PWD=${security.pwd}`;
                        }
                        const connectionConfig = {
                            connectionString: connectionsString,
                            connectionTimeout: 10,
                            loginTimeout: 10,
                        }
                        this.connection = await odbc.connect(connectionConfig);
                        this.pool = await odbc.pool(connectionConfig);
                        logger.info(`'${data.name}' connected!`);
                        _emitStatus('connect-ok');
                        _checkWorking(false);
                        resolve();
                        return;
                    }
                } catch (err) {
                    if (data.enabled) {
                        logger.error(`'${data.name}' try to connect error! ${err}`);
                        _emitStatus('connect-error');
                    }
                }
                if (this.connection) {
                    try {
                        this.connection.close();
                    } catch { }
                }
                reject();
            } else {
                logger.error(`'${data.name}' missing connection data!`);
                _emitStatus('connect-failed');
                reject();
            }
            _checkWorking(false);
        })
    }


    /**
     * Disconnect
     * Emit connection status to clients, clear all Tags values
     */
    this.disconnect = function () {
        return new Promise(async (resolve, reject) => {
            if (this.connection) {
                try {
                    await this.pool.close();
                    await this.connection.close();
                } catch { }
            }
            _checkWorking(false);
            _emitStatus('connect-off');
            resolve(true);
        })
    }

    /**
     * Browse Table to read column
     */
    this.browse = function (node) {
        var self = this;
        return new Promise( async function (resolve, reject) {
                console.log(`'${data.name}' browse called with node: ${node}`);
                let tempConnection = null;
                let useTempConnection = false;

                if (!self.connection) {
                    // Create temporary connection for browsing
                    try {
                        var security = {};
                        await getProperty({query: 'security', name: data.id}).then((result, error) => {
                            if (result) {
                                security = utils.JsonTryToParse(result.value) || {};
                            }
                        });
                        var connectionsString = data.property.address;
                        if (security.uid) {
                            connectionsString += `;UID=${security.uid}`;
                        }
                        if (security.pwd) {
                            connectionsString += `;PWD=${security.pwd}`;
                        }
                        const connectionConfig = {
                            connectionString: connectionsString,
                            connectionTimeout: 10,
                            loginTimeout: 10,
                        };
                        tempConnection = await odbc.connect(connectionConfig);
                        useTempConnection = true;
                    } catch (err) {
                        reject('Failed to connect for browsing: ' + err);
                        return;
                    }
                }

                const connection = useTempConnection ? tempConnection : self.connection;

                if (_checkWorking(true) || useTempConnection) {
                    try {
                        // Try to get columns - try different schema options
                        const tableName = node || currentTable;
                        let columns = [];

                        logger.info(`'${data.name}' browsing table: ${tableName}`);

                        // Extract database name from connection string for catalog parameter
                        let databaseName = null;
                        const address = data.property.address;
                        const dbMatch = address.match(/Database=([^;]+)/i) || address.match(/DB=([^;]+)/i) || address.match(/DATABASE=([^;]+)/i);
                        if (dbMatch) {
                            databaseName = dbMatch[1];
                            logger.info(`'${data.name}' extracted database name: ${databaseName}`);
                        }

                        // Try multiple approaches for different databases
                        const dbType = self._getDBType();
                        const attempts = self._getBrowseApproaches(dbType, tableName);

                        let success = false;
                        
                        // FIRST, try SQL query approach to get FULL metadata (nullable, defaults, primary key, identity)
                        logger.info(`'${data.name}' trying SQL query approach for full column metadata on ${dbType}`);
                        const queries = self._getSchemaDetectionQueries(dbType, tableName);
                        
                        for (const query of queries) {
                            try {
                                logger.info(`'${data.name}' executing schema query: ${query}`);
                                const result = await connection.query(query);
                                
                                if (Array.isArray(result) && result.length > 0) {
                                    columns = result;
                                    logger.info(`'${data.name}' found ${columns.length} columns via SQL query`);
                                    success = true;
                                    break;
                                }
                            } catch (err) {
                                logger.warn(`'${data.name}' schema query failed: ${err}`);
                            }
                        }

                        // FALLBACK to metadata API if SQL queries failed
                        if (!success) {
                            logger.info(`'${data.name}' falling back to ODBC metadata API for columns on ${dbType}`);
                            for (const attempt of attempts) {
                                try {
                                    columns = await connection.columns(attempt.catalog, attempt.schema, attempt.table, null);
                                    logger.info(`'${data.name}' found ${columns.length} columns with ${dbType} approach: catalog=${attempt.catalog}, schema=${attempt.schema}, table=${attempt.table}`);
                                    success = true;
                                    break;
                                } catch (err) {
                                    logger.warn(`'${data.name}' attempt failed catalog=${attempt.catalog}, schema=${attempt.schema}, table=${attempt.table}: ${err}`);
                                }
                            }
                        }

                        if (!success) {
                            throw new Error('Failed to get columns with all attempts');
                        }

                        // Parse columns with full metadata based on database type
                        let parsedColumns = [];
                        
                        if (dbType === 'sqlite' && Array.isArray(columns) && columns.length > 0 && columns[0].cid !== undefined) {
                            // SQLite PRAGMA table_info returns: [cid, name, type, notnull, dflt_value, pk]
                            parsedColumns = columns.map(row => ({
                                COLUMN_NAME: row.name,
                                TYPE_NAME: row.type,
                                IS_NULLABLE: row.notnull ? 'NO' : 'YES',
                                COLUMN_DEFAULT: row.dflt_value,
                                IS_PRIMARY_KEY: row.pk ? 1 : 0
                            }));
                        } else if (dbType === 'mysql' || dbType === 'mariadb') {
                            // MySQL SHOW COLUMNS returns: Field, Type, Null, Key, Default, Extra
                            parsedColumns = columns.map(row => ({
                                COLUMN_NAME: row.Field || row.column_name || row.COLUMN_NAME,
                                TYPE_NAME: row.Type || row.data_type || row.DATA_TYPE || row.COLUMN_TYPE,
                                IS_NULLABLE: row.Null === 'YES' ? 'YES' : (row.is_nullable === 'YES' ? 'YES' : 'NO'),
                                COLUMN_DEFAULT: row.Default || row.column_default || row.COLUMN_DEFAULT,
                                IS_PRIMARY_KEY: row.Key === 'PRI' ? 1 : (row.is_primary_key ? 1 : 0),
                                IS_IDENTITY: row.Extra && row.Extra.includes('auto_increment') ? 1 : 0
                            }));
                        } else if (Array.isArray(columns) && columns.length > 0) {
                            // Generic SQL result parsing for PostgreSQL and SQL Server
                            parsedColumns = columns.map(row => ({
                                COLUMN_NAME: row.column_name || row.COLUMN_NAME || row.Field,
                                TYPE_NAME: row.data_type || row.DATA_TYPE || row.Type || row.COLUMN_TYPE,
                                IS_NULLABLE: (row.is_nullable || row.IS_NULLABLE) === 'YES' ? 'YES' : (row.Null === 'YES' ? 'YES' : 'NO'),
                                COLUMN_DEFAULT: row.column_default || row.COLUMN_DEFAULT || row.Default,
                                IS_PRIMARY_KEY: row.is_primary_key || row.IS_PRIMARY_KEY || (row.Key === 'PRI' ? 1 : 0) || 0,
                                IS_IDENTITY: row.is_identity || row.IS_IDENTITY || 0
                            }));
                        }

                        // Try to retrieve foreign key information
                        let foreignKeyMap = {};
                        try {
                            const fkQueries = self._getForeignKeyQueries(dbType, tableName);
                            for (const query of fkQueries) {
                                try {
                                    logger.info(`'${data.name}' executing FK query: ${query}`);
                                    const fkResult = await connection.query(query);
                                    
                                    if (Array.isArray(fkResult) && fkResult.length > 0) {
                                        // Parse foreign key results based on database type
                                        fkResult.forEach(row => {
                                            const colName = row.column_name || row.COLUMN_NAME || row.table_field || row.from;
                                            const refTable = row.foreign_table_name || row.REFERENCED_TABLE_NAME || row.table || row.to;
                                            const refCol = row.foreign_column_name || row.REFERENCED_COLUMN_NAME || row.column || row.to_column;
                                            
                                            if (colName && refTable && refCol) {
                                                foreignKeyMap[colName] = {
                                                    tableName: refTable,
                                                    columnName: refCol
                                                };
                                                logger.info(`'${data.name}' found FK: ${colName} -> ${refTable}.${refCol}`);
                                            }
                                        });
                                        break;
                                    }
                                } catch (err) {
                                    logger.warn(`'${data.name}' FK query failed: ${err}`);
                                }
                            }
                        } catch (err) {
                            logger.warn(`'${data.name}' error retrieving foreign keys: ${err}`);
                        }

                        const result = parsedColumns.map(column => {
                            // Strictly check if isIdentity is true (could be boolean true, number 1, or string '1'/'t'/'true')
                            // ODBC drivers may return different representations: string "1", number 1, boolean true, or string 't'/'true'
                            const isIdentityRaw = column.IS_IDENTITY;
                            let isIdentity = false;
                            if (isIdentityRaw === true || isIdentityRaw === 1 || isIdentityRaw === '1' || isIdentityRaw === 't' || isIdentityRaw === 'true' || isIdentityRaw === 'TRUE') {
                                isIdentity = true;
                            }
                            
                            // Detect AUTO_TIMESTAMP from defaultValue containing CURRENT_TIMESTAMP, GETDATE(), or NOW()
                            // Only if it's NOT an auto-increment column (mutually exclusive)
                            let isAutoTimestamp = false;
                            if (!isIdentity && column.COLUMN_DEFAULT) {
                                const defaultUpper = column.COLUMN_DEFAULT.toUpperCase();
                                isAutoTimestamp = (
                                    defaultUpper.includes('CURRENT_TIMESTAMP') ||
                                    defaultUpper.includes('GETDATE') ||
                                    defaultUpper.includes('NOW')
                                );
                            }
                            
                            const colResult = {
                                id: column.COLUMN_NAME,
                                name: column.COLUMN_NAME,
                                type: column.TYPE_NAME,
                                nullable: column.IS_NULLABLE === 'YES',
                                defaultValue: column.COLUMN_DEFAULT,
                                isPrimaryKey: column.IS_PRIMARY_KEY ? true : false,
                                isIdentity: isIdentity,
                                isAutoTimestamp: isAutoTimestamp,
                                class: 'Variable'
                            };
                            
                            // Attach foreign key information if available
                            if (foreignKeyMap[column.COLUMN_NAME]) {
                                colResult.foreignKey = foreignKeyMap[column.COLUMN_NAME];
                            }
                            
                            return colResult;
                        });
                        logger.info(`'${data.name}' returning ${result.length} columns with full metadata: ${result.map(c => c.name).join(', ')}`);
                        logger.info(`'${data.name}' column details: ${JSON.stringify(result)}`);
                        resolve(result);
                    } catch (err) {
                        if (err) {
                            logger.error(`'${data.name}' browse failure! ${err}`);
                        }
                        reject(err);
                    } finally {
                        if (tempConnection) {
                            try {
                                await tempConnection.close();
                            } catch (e) {
                                // Ignore close errors
                            }
                        }
                        if (!useTempConnection) {
                            _checkWorking(false);
                        }
                    }
                } else {
                    if (tempConnection) {
                        try {
                            await tempConnection.close();
                        } catch (e) {
                            // Ignore close errors
                        }
                    }
                    reject('Device is busy');
                }
        });
    }

    /**
     * Detect database type from connection
     */
    this._getDBType = function () {
        if (!this.connection) return 'unknown';
        
        // Try to get database product name from connection metadata
        if (this.connection.getInfo) {
            try {
                const dbProductName = this.connection.getInfo(17); // SQL_DBMS_NAME
                if (dbProductName) {
                    const name = dbProductName.toLowerCase();
                    if (name.includes('postgresql')) return 'postgresql';
                    if (name.includes('mysql')) return 'mysql';
                    if (name.includes('mariadb')) return 'mariadb';
                    if (name.includes('sql server')) return 'sqlserver';
                    if (name.includes('sqlite')) return 'sqlite';
                }
            } catch (err) {
                logger.warn(`'${data.name}' could not detect DB type from metadata: ${err}`);
            }
        }
        
        // Fallback: analyze connection string
        const connStr = (data.property && data.property.address) ? data.property.address.toLowerCase() : '';
        if (connStr.includes('postgresql')) return 'postgresql';
        if (connStr.includes('mysql') && !connStr.includes('mariadb')) return 'mysql';
        if (connStr.includes('mariadb')) return 'mariadb';
        if (connStr.includes('driver={sql server}') || connStr.includes('driver=odbc driver 18 for sql server')) return 'sqlserver';
        if (connStr.includes('freetds')) return 'sqlserver'; // FreeTDS is for SQL Server
        if (connStr.includes('sqlite')) return 'sqlite';
        
        logger.warn(`'${data.name}' could not determine database type, using generic approach`);
        return 'unknown';
    }

    /**
     * Get schema detection queries for specific database
     */
    this._getSchemaDetectionQueries = function(dbType, tableName) {
        const queries = [];
        
        switch(dbType) {
            case 'postgresql':
                // PostgreSQL: comprehensive column info including constraints and auto-increment detection
                queries.push(
                    `SELECT 
                        c.column_name, 
                        c.data_type, 
                        c.udt_name,
                        c.is_nullable,
                        c.column_default,
                        pk.constraint_name IS NOT NULL as is_primary_key,
                        (SELECT COUNT(*) FROM information_schema.table_constraints tc 
                         WHERE tc.constraint_type = 'FOREIGN KEY' 
                         AND tc.table_name = '${tableName}') > 0 as has_foreign_keys,
                        CASE WHEN c.data_type IN ('serial', 'bigserial', 'smallserial') THEN true
                             WHEN c.column_default IS NOT NULL AND c.column_default::TEXT ILIKE '%nextval%' THEN true
                             ELSE false END as is_identity
                    FROM information_schema.columns c
                    LEFT JOIN information_schema.key_column_usage pk 
                        ON c.table_name = pk.table_name 
                        AND c.column_name = pk.column_name 
                        AND pk.constraint_name LIKE '%_pkey'
                    WHERE c.table_name = '${tableName}'
                    ORDER BY c.ordinal_position`
                );
                break;
            case 'mysql':
            case 'mariadb':
                // MySQL/MariaDB: SHOW COLUMNS includes DEFAULT, NULL, KEY info
                queries.push(
                    `SHOW COLUMNS FROM ${tableName}`
                );
                break;
            case 'sqlserver':
                // SQL Server: comprehensive column info from system views
                queries.push(
                    `SELECT 
                        c.COLUMN_NAME,
                        c.DATA_TYPE,
                        c.IS_NULLABLE,
                        c.COLUMN_DEFAULT,
                        CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as is_primary_key,
                        COLUMNPROPERTY(OBJECT_ID('${tableName}'), c.COLUMN_NAME, 'IsIdentity') as is_identity
                    FROM INFORMATION_SCHEMA.COLUMNS c
                    LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE pk
                        ON c.TABLE_NAME = pk.TABLE_NAME
                        AND c.COLUMN_NAME = pk.COLUMN_NAME
                        AND pk.CONSTRAINT_TYPE = 'PRIMARY KEY'
                    WHERE c.TABLE_NAME = '${tableName}'
                    ORDER BY ORDINAL_POSITION`
                );
                break;
            case 'sqlite':
                // SQLite: PRAGMA table_info returns [cid, name, type, notnull, dflt_value, pk]
                queries.push(
                    `PRAGMA table_info(${tableName})`
                );
                break;
            default:
                // Try all common approaches
                queries.push(
                    `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = '${tableName}' ORDER BY ordinal_position`,
                    `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${tableName}' ORDER BY ORDINAL_POSITION`,
                    `SHOW COLUMNS FROM ${tableName}`
                );
        }
        
        return queries;
    }

    /**
     * Get foreign key queries for specific database table
     */
    this._getForeignKeyQueries = function(dbType, tableName) {
        const queries = [];
        
        switch(dbType) {
            case 'postgresql':
                // PostgreSQL: Foreign key information
                queries.push(
                    `SELECT 
                        tc.constraint_name,
                        kcu.column_name,
                        ccu.table_name AS foreign_table_name,
                        ccu.column_name AS foreign_column_name
                    FROM information_schema.table_constraints AS tc
                    JOIN information_schema.key_column_usage AS kcu
                        ON tc.constraint_name = kcu.constraint_name
                        AND tc.table_schema = kcu.table_schema
                    JOIN information_schema.constraint_column_usage AS ccu
                        ON ccu.constraint_name = tc.constraint_name
                        AND ccu.table_schema = tc.table_schema
                    WHERE tc.constraint_type = 'FOREIGN KEY'
                        AND tc.table_name = '${tableName}'`
                );
                break;
            case 'mysql':
            case 'mariadb':
                // MySQL/MariaDB: Foreign key information
                queries.push(
                    `SELECT 
                        CONSTRAINT_NAME,
                        COLUMN_NAME,
                        REFERENCED_TABLE_NAME,
                        REFERENCED_COLUMN_NAME
                    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                    WHERE TABLE_NAME = '${tableName}'
                        AND REFERENCED_TABLE_NAME IS NOT NULL`
                );
                break;
            case 'sqlserver':
                // SQL Server: Foreign key information
                queries.push(
                    `SELECT 
                        fk.name AS CONSTRAINT_NAME,
                        col.name AS COLUMN_NAME,
                        ref_table.name AS REFERENCED_TABLE_NAME,
                        ref_col.name AS REFERENCED_COLUMN_NAME
                    FROM sys.foreign_keys AS fk
                    INNER JOIN sys.tables AS tab ON fk.parent_object_id = tab.object_id
                    INNER JOIN sys.columns AS col ON fk.parent_object_id = col.object_id AND fk.parent_column_id = col.column_id
                    INNER JOIN sys.tables AS ref_table ON fk.referenced_object_id = ref_table.object_id
                    INNER JOIN sys.columns AS ref_col ON fk.referenced_object_id = ref_col.object_id AND fk.referenced_column_id = ref_col.column_id
                    WHERE tab.name = '${tableName}'`
                );
                break;
            case 'sqlite':
                // SQLite: Foreign key information
                queries.push(
                    `PRAGMA foreign_key_list(${tableName})`
                );
                break;
            default:
                // Generic approach
                queries.push(
                    `SELECT 
                        CONSTRAINT_NAME,
                        COLUMN_NAME,
                        REFERENCED_TABLE_NAME,
                        REFERENCED_COLUMN_NAME
                    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                    WHERE TABLE_NAME = '${tableName}'
                        AND REFERENCED_TABLE_NAME IS NOT NULL`
                );
        }
        
        return queries;
    }

    /**
     * Get schema browsing approaches for specific database
     */
    this._getBrowseApproaches = function(dbType, tableName) {
        const approaches = [];
        
        switch(dbType) {
            case 'postgresql':
                approaches.push(
                    { catalog: null, schema: 'public', table: tableName },
                    { catalog: null, schema: 'public', table: `"${tableName}"` },
                    { catalog: null, schema: null, table: tableName },
                    { catalog: null, schema: null, table: `"${tableName}"` }
                );
                break;
            case 'mysql':
            case 'mariadb':
                approaches.push(
                    { catalog: null, schema: null, table: tableName },
                    { catalog: null, schema: null, table: `\`${tableName}\`` }
                );
                break;
            case 'sqlserver':
                approaches.push(
                    { catalog: null, schema: 'dbo', table: tableName },
                    { catalog: null, schema: 'dbo', table: `"${tableName}"` },
                    { catalog: null, schema: 'dbo', table: `[${tableName}]` },
                    { catalog: null, schema: null, table: tableName },
                    { catalog: null, schema: null, table: `[${tableName}]` }
                );
                break;
            case 'sqlite':
                approaches.push(
                    { catalog: null, schema: null, table: tableName }
                );
                break;
            default:
                approaches.push(
                    { catalog: null, schema: 'dbo', table: tableName },
                    { catalog: null, schema: 'public', table: tableName },
                    { catalog: null, schema: null, table: tableName }
                );
        }
        
        return approaches;
    }

    /**
     * Normalize SQL query for specific database
     */
    this._normalizeSqlQuery = function (query, dbType) {
        if (!dbType || dbType === 'unknown') return query;
        
        let normalized = query;
        
        // Normalize data types for CREATE TABLE and ALTER TABLE statements
        if (query.toUpperCase().includes('CREATE TABLE') || query.toUpperCase().includes('ALTER TABLE')) {
            normalized = this._normalizeDataTypes(normalized, dbType);
        }
        
        // Normalize AUTO_INCREMENT syntax for CREATE TABLE and ALTER TABLE
        if (query.toUpperCase().includes('AUTO_INCREMENT')) {
            normalized = this._normalizeAutoIncrement(normalized, dbType);
        }
        
        // Normalize CURRENT_TIMESTAMP for CREATE TABLE and ALTER TABLE
        if (query.toUpperCase().includes('CURRENT_TIMESTAMP')) {
            normalized = this._normalizeCurrentTimestamp(normalized, dbType);
        }
        
        // Normalize ALTER TABLE syntax for different databases
        if (query.toUpperCase().includes('ALTER TABLE')) {
            normalized = this._normalizeAlterTableSyntax(normalized, dbType);
        }
        
        return normalized;
    }

    /**
     * Normalize data types based on database type
     */
    this._normalizeDataTypes = function (query, dbType) {
        const typeMap = {
            // String types - map to database-specific equivalents
            'VARCHAR': {
                postgresql: 'VARCHAR',
                mysql: 'VARCHAR',
                mariadb: 'VARCHAR',
                sqlserver: 'VARCHAR',
                sqlite: 'TEXT',
                unknown: 'VARCHAR'
            },
            'CHAR': {
                postgresql: 'CHAR',
                mysql: 'CHAR',
                mariadb: 'CHAR',
                sqlserver: 'CHAR',
                sqlite: 'TEXT',
                unknown: 'CHAR'
            },
            'TEXT': {
                postgresql: 'TEXT',
                mysql: 'TEXT',
                mariadb: 'TEXT',
                sqlserver: 'TEXT',
                sqlite: 'TEXT',
                unknown: 'TEXT'
            },
            'UUID': {
                postgresql: 'UUID',
                mysql: 'CHAR(36)',
                mariadb: 'CHAR(36)',
                sqlserver: 'UNIQUEIDENTIFIER',
                sqlite: 'TEXT',
                unknown: 'UUID'
            },
            'JSON': {
                postgresql: 'JSON',
                mysql: 'JSON',
                mariadb: 'JSON',
                sqlserver: 'NVARCHAR(MAX)',
                sqlite: 'TEXT',
                unknown: 'JSON'
            },
            'JSONB': {
                postgresql: 'JSONB',
                mysql: 'JSON',
                mariadb: 'JSON',
                sqlserver: 'NVARCHAR(MAX)',
                sqlite: 'TEXT',
                unknown: 'JSONB'
            },
            'BYTEA': {
                postgresql: 'BYTEA',
                mysql: 'BLOB',
                mariadb: 'BLOB',
                sqlserver: 'VARBINARY(MAX)',
                sqlite: 'BLOB',
                unknown: 'BYTEA'
            },
            // Numeric types
            'INTEGER': {
                postgresql: 'INTEGER',
                mysql: 'INT',
                mariadb: 'INT',
                sqlserver: 'INT',
                sqlite: 'INTEGER',
                unknown: 'INTEGER'
            },
            'SMALLINT': {
                postgresql: 'SMALLINT',
                mysql: 'SMALLINT',
                mariadb: 'SMALLINT',
                sqlserver: 'SMALLINT',
                sqlite: 'INTEGER',
                unknown: 'SMALLINT'
            },
            'BIGINT': {
                postgresql: 'BIGINT',
                mysql: 'BIGINT',
                mariadb: 'BIGINT',
                sqlserver: 'BIGINT',
                sqlite: 'INTEGER',
                unknown: 'BIGINT'
            },
            'FLOAT': {
                postgresql: 'FLOAT',
                mysql: 'FLOAT',
                mariadb: 'FLOAT',
                sqlserver: 'FLOAT',
                sqlite: 'REAL',
                unknown: 'FLOAT'
            },
            'REAL': {
                postgresql: 'REAL',
                mysql: 'REAL',
                mariadb: 'REAL',
                sqlserver: 'REAL',
                sqlite: 'REAL',
                unknown: 'REAL'
            },
            'DECIMAL': {
                postgresql: 'DECIMAL',
                mysql: 'DECIMAL',
                mariadb: 'DECIMAL',
                sqlserver: 'DECIMAL',
                sqlite: 'REAL',
                unknown: 'DECIMAL'
            },
            'NUMERIC': {
                postgresql: 'NUMERIC',
                mysql: 'NUMERIC',
                mariadb: 'NUMERIC',
                sqlserver: 'NUMERIC',
                sqlite: 'REAL',
                unknown: 'NUMERIC'
            },
            // Date/Time types
            'DATE': {
                postgresql: 'DATE',
                mysql: 'DATE',
                mariadb: 'DATE',
                sqlserver: 'DATE',
                sqlite: 'DATE',
                unknown: 'DATE'
            },
            'TIME': {
                postgresql: 'TIME',
                mysql: 'TIME',
                mariadb: 'TIME',
                sqlserver: 'TIME',
                sqlite: 'TEXT',
                unknown: 'TIME'
            },
            'TIMESTAMP': {
                postgresql: 'TIMESTAMP',
                mysql: 'TIMESTAMP',
                mariadb: 'TIMESTAMP',
                sqlserver: 'DATETIME',
                sqlite: 'DATETIME',
                unknown: 'TIMESTAMP'
            },
            'TIMESTAMP WITH TIME ZONE': {
                postgresql: 'TIMESTAMP WITH TIME ZONE',
                mysql: 'DATETIME',
                mariadb: 'DATETIME',
                sqlserver: 'DATETIMEOFFSET',
                sqlite: 'TEXT',
                unknown: 'TIMESTAMP WITH TIME ZONE'
            },
            'TIMESTAMP WITHOUT TIME ZONE': {
                postgresql: 'TIMESTAMP WITHOUT TIME ZONE',
                mysql: 'DATETIME',
                mariadb: 'DATETIME',
                sqlserver: 'DATETIME',
                sqlite: 'DATETIME',
                unknown: 'TIMESTAMP'
            },
            // Boolean
            'BOOLEAN': {
                postgresql: 'BOOLEAN',
                mysql: 'BOOLEAN',
                mariadb: 'BOOLEAN',
                sqlserver: 'BIT',
                sqlite: 'INTEGER',
                unknown: 'BOOLEAN'
            },
            // Special types
            'ENUM': {
                postgresql: 'ENUM',
                mysql: 'ENUM',
                mariadb: 'ENUM',
                sqlserver: 'NVARCHAR(50)',
                sqlite: 'TEXT',
                unknown: 'ENUM'
            },
            'ARRAY': {
                postgresql: 'ARRAY',
                mysql: 'JSON',
                mariadb: 'JSON',
                sqlserver: 'NVARCHAR(MAX)',
                sqlite: 'TEXT',
                unknown: 'ARRAY'
            }
        };

        let normalized = query;
        
        // Replace data types based on the target database
        for (const [sourceType, targets] of Object.entries(typeMap)) {
            const targetType = targets[dbType] || targets['unknown'];
            if (targetType !== sourceType) {
                // Match with parentheses for sized types (VARCHAR(255)) and without
                const regexWithSize = new RegExp(`\\b${sourceType}\\([^)]*\\)`, 'gi');
                const regexWithoutSize = new RegExp(`\\b${sourceType}\\b`, 'gi');
                
                normalized = normalized.replace(regexWithSize, (match) => {
                    // Keep the size for VARCHAR, DECIMAL, etc
                    if (sourceType === 'VARCHAR' || sourceType === 'DECIMAL') {
                        return targetType + match.substring(sourceType.length);
                    }
                    return targetType;
                });
                
                normalized = normalized.replace(regexWithoutSize, targetType);
            }
        }
        
        logger.info(`'${data.name}' normalized query for ${dbType}: ${normalized}`);
        return normalized;
    }

    /**
     * Normalize ALTER TABLE syntax for different databases
     */
    this._normalizeAlterTableSyntax = function (query, dbType) {
        if (!dbType || dbType === 'unknown') return query;
        
        let normalized = query;
        
        // Different databases use different syntax for ALTER TABLE modifications
        // PostgreSQL: ALTER TABLE table ALTER COLUMN column TYPE newtype [constraints];
        // MySQL: ALTER TABLE table MODIFY COLUMN column newtype [constraints];
        // SQL Server: ALTER TABLE table ALTER COLUMN column newtype [constraints];
        // SQLite: Doesn't support ALTER COLUMN, requires recreate
        
        if (query.toUpperCase().includes('MODIFY COLUMN')) {
            switch(dbType) {
                case 'postgresql':
                    // PostgreSQL: ALTER TABLE table MODIFY COLUMN col TYPE vartype NOT NULL;
                    // becomes: ALTER TABLE table ALTER COLUMN col TYPE vartype; ALTER TABLE table ALTER COLUMN col SET NOT NULL;
                    
                    // Special handling for SERIAL type (auto-increment)
                    // SERIAL is not valid in ALTER TABLE TYPE, must use bigserial or create sequence
                    const pgPattern = /ALTER\s+TABLE\s+(\S+)\s+MODIFY\s+COLUMN\s+(\w+)\s+(SERIAL|BIGSERIAL|SMALLSERIAL)(.*?)(?:;|$)/gi;
                    if (pgPattern.test(normalized)) {
                        normalized = normalized.replace(pgPattern, (match, tableName, colName, colType, constraints) => {
                            // For SERIAL type changes in ALTER, create a sequence and set default
                            const seqName = `${tableName}_${colName}_seq`;
                            let result = `CREATE SEQUENCE IF NOT EXISTS ${seqName}; ALTER TABLE ${tableName} ALTER COLUMN ${colName} SET DEFAULT nextval('${seqName}')`;
                            if (constraints && constraints.trim()) {
                                const notNullMatch = constraints.match(/NOT\s+NULL/i);
                                if (notNullMatch) {
                                    result += `; ALTER TABLE ${tableName} ALTER COLUMN ${colName} SET NOT NULL`;
                                }
                            }
                            result += `;`;
                            return result;
                        });
                    } else {
                        // Standard type changes
                        const standardPattern = /ALTER\s+TABLE\s+(\S+)\s+MODIFY\s+COLUMN\s+(\w+)\s+([\w()]+)(.*?)(?:;|$)/gi;
                        normalized = normalized.replace(standardPattern, (match, tableName, colName, colType, constraints) => {
                            let result = `ALTER TABLE ${tableName} ALTER COLUMN ${colName} TYPE ${colType}`;
                            if (constraints && constraints.trim()) {
                                // Handle NOT NULL and other constraints separately for PostgreSQL
                                const notNullMatch = constraints.match(/NOT\s+NULL/i);
                                if (notNullMatch) {
                                    result += `; ALTER TABLE ${tableName} ALTER COLUMN ${colName} SET NOT NULL`;
                                }
                                const defaultMatch = constraints.match(/DEFAULT\s+('[^']*'|\S+)/i);
                                if (defaultMatch) {
                                    result += `; ALTER TABLE ${tableName} ALTER COLUMN ${colName} SET ${defaultMatch[0]}`;
                                }
                            }
                            result += `;`;
                            return result;
                        });
                    }
                    break;
                    
                case 'sqlserver':
                    // SQL Server: ALTER TABLE table ALTER COLUMN column newtype [constraints];
                    normalized = normalized.replace(/MODIFY\s+COLUMN/gi, 'ALTER COLUMN');
                    break;
                    
                case 'mysql':
                case 'mariadb':
                    // MySQL/MariaDB keep MODIFY COLUMN as-is
                    break;
                    
                case 'sqlite':
                    // SQLite doesn't support ALTER COLUMN, log warning
                    logger.warn(`'${data.name}' SQLite does not support ALTER COLUMN. Column modifications require table recreation.`);
                    break;
            }
        }
        
        logger.info(`'${data.name}' normalized ALTER syntax for ${dbType}: ${normalized}`);
        return normalized;
    }

    /**
     * Normalize AUTO_INCREMENT syntax for different databases
     */
    this._normalizeAutoIncrement = function (query, dbType) {
        if (!dbType || dbType === 'unknown') return query;
        
        let normalized = query;
        
        // Handle AUTO_INCREMENT keyword based on database type
        switch(dbType) {
            case 'postgresql':
                // PostgreSQL uses SERIAL type or GENERATED BY DEFAULT AS IDENTITY
                // Convert: `id INTEGER AUTO_INCREMENT` to `id SERIAL`
                // Handle different integer sizes
                const pgBigintPattern = /(\w+)\s+(BIGINT)\s+AUTO_INCREMENT/gi;
                normalized = normalized.replace(pgBigintPattern, (match, colName, colType) => {
                    return `${colName} BIGSERIAL`;
                });
                
                const pgSmallintPattern = /(\w+)\s+(SMALLINT)\s+AUTO_INCREMENT/gi;
                normalized = normalized.replace(pgSmallintPattern, (match, colName, colType) => {
                    return `${colName} SMALLSERIAL`;
                });
                
                const pgPattern = /(\w+)\s+(INTEGER|INT)\s+AUTO_INCREMENT/gi;
                normalized = normalized.replace(pgPattern, (match, colName, colType) => {
                    return `${colName} SERIAL`;
                });
                break;
                
            case 'sqlserver':
                // SQL Server uses IDENTITY(seed, increment)
                // Convert: `id INTEGER AUTO_INCREMENT` to `id INT IDENTITY(1,1)`
                // All numeric types use same syntax
                const ssPattern = /(\w+)\s+(INT|INTEGER|BIGINT|SMALLINT)\s+AUTO_INCREMENT/gi;
                normalized = normalized.replace(ssPattern, (match, colName, colType) => {
                    return `${colName} ${colType} IDENTITY(1,1)`;
                });
                break;
                
            case 'sqlite':
                // SQLite uses AUTOINCREMENT keyword (or just INTEGER PRIMARY KEY)
                // Keep AUTO_INCREMENT as-is, SQLite will handle it
                // Convert: `id INTEGER AUTO_INCREMENT` to `id INTEGER PRIMARY KEY AUTOINCREMENT`
                const sqlitePattern = /(\w+)\s+(INTEGER)\s+AUTO_INCREMENT/gi;
                normalized = normalized.replace(sqlitePattern, (match, colName, colType) => {
                    return `${colName} INTEGER PRIMARY KEY AUTOINCREMENT`;
                });
                break;
                
            case 'mysql':
            case 'mariadb':
            default:
                // MySQL/MariaDB keep AUTO_INCREMENT as-is, they handle all numeric types
                break;
        }
        
        logger.info(`'${data.name}' normalized AUTO_INCREMENT for ${dbType}: ${normalized}`);
        return normalized;
    }

    /**
     * Normalize CURRENT_TIMESTAMP function for different databases
     */
    this._normalizeCurrentTimestamp = function (query, dbType) {
        if (!dbType || dbType === 'unknown') return query;
        
        let normalized = query;
        
        // Handle CURRENT_TIMESTAMP function based on database type
        switch(dbType) {
            case 'sqlserver':
                // SQL Server uses GETDATE() or SYSDATETIME()
                // Convert: DEFAULT CURRENT_TIMESTAMP to DEFAULT GETDATE()
                normalized = normalized.replace(/DEFAULT\s+CURRENT_TIMESTAMP/gi, 'DEFAULT GETDATE()');
                break;
                
            case 'postgresql':
            case 'mysql':
            case 'mariadb':
            case 'sqlite':
            default:
                // PostgreSQL, MySQL, MariaDB, SQLite all support CURRENT_TIMESTAMP
                // No conversion needed
                break;
        }
        
        logger.info(`'${data.name}' normalized CURRENT_TIMESTAMP for ${dbType}: ${normalized}`);
        return normalized;
    }

    this.executeQuery = function (query) {
        var self = this;
        console.log(`ODBC executeQuery called with query: ${query}`);
        return new Promise(async function (resolve, reject) {
            // Add query to queue
            queryQueue.push({ query: query, resolve: resolve, reject: reject });
            
            // Process the queue if not already processing
            self._processQueryQueue();
        });
    }

    /**
     * Process the query queue
     */
    this._processQueryQueue = function () {
        var self = this;
        if (working || queryQueue.length === 0) {
            return; // Already processing or no queries to process
        }
        
        var queueItem = queryQueue.shift();
        var query = queueItem.query;
        var resolve = queueItem.resolve;
        var reject = queueItem.reject;
        
        // Mark as working
        if (!_checkWorking(true)) {
            // This shouldn't happen since we check working above, but just in case
            reject('Device is busy');
            return;
        }
        
        // Execute the query
        self._executeQueryInternal(query).then(function(result) {
            resolve(result);
            _checkWorking(false);
            // Process next query in queue
            self._processQueryQueue();
        }).catch(function(err) {
            reject(err);
            _checkWorking(false);
            // Process next query in queue even on error
            self._processQueryQueue();
        });
    }

    /**
     * Internal query execution (without queue management)
     */
    this._executeQueryInternal = function (query) {
        var self = this;
        return new Promise(async function (resolve, reject) {
            try {
                if (self.connection) {
                    // Detect database type and normalize query
                    const dbType = self._getDBType();
                    logger.info(`'${data.name}' executing query on ${dbType}: ${query}`);
                    let normalizedQuery = self._normalizeSqlQuery(query, dbType);
                    
                    // CRITICAL: Use date-formatter to normalize all date/time values in the query
                    // This handles:
                    // - JavaScript Date object toString() format (e.g., "Fri Nov 07 2025 14:31:22 GMT+1300 (New Zealand Daylight Time)")
                    // - ISO format (e.g., "2025-01-15", "2025-01-15T14:30:45")
                    // - US format (e.g., "01/15/2025", "01/15/2025 14:30:45")
                    // - EU format (e.g., "15/01/2025", "15/01/2025 14:30:45")
                    // Auto-detection ensures consistent formatting across all database types
                    try {
                        const formattedQuery = self._formatDateObjectsInQuery(normalizedQuery);
                        logger.info(`'${data.name}' formatted date/time values in query`);
                        normalizedQuery = formattedQuery;
                    } catch (err) {
                        logger.warn(`'${data.name}' date/time formatting warning: ${err}`);
                        // Continue with original query if formatting fails
                    }
                    
                    // Check if query contains multiple statements (separated by semicolons)
                    // This happens with PostgreSQL ALTER TABLE normalizations
                    const statements = normalizedQuery.split(';').map(s => s.trim()).filter(s => s.length > 0);
                    
                    if (statements.length > 1) {
                        logger.info(`'${data.name}' detected ${statements.length} statements, executing sequentially`);
                        try {
                            let lastResult = null;
                            for (const stmt of statements) {
                                logger.info(`'${data.name}' executing statement: ${stmt}`);
                                const result = await self.connection.query(stmt);
                                lastResult = result;
                                logger.info(`'${data.name}' statement executed successfully`);
                            }
                            logger.info(`'${data.name}' all statements executed successfully`);
                            resolve(lastResult);
                            return;
                        } catch (err) {
                            logger.warn(`'${data.name}' multi-statement query failed: ${err}`);
                        }
                    }
                    
                    // Try single statement as-is first
                    try {
                        const result = await self.connection.query(normalizedQuery);
                        logger.info(`'${data.name}' query executed successfully`);
                        resolve(result);
                        return;
                    } catch (err) {
                        logger.warn(`'${data.name}' query failed as-is, trying variations: ${err}`);
                    }
                    
                    // If the query contains table names, try different quoting approaches
                    if (normalizedQuery.toUpperCase().includes(' FROM ') || normalizedQuery.toUpperCase().includes('SELECT ')) {
                        // Extract potential table names from the query
                        const tableNames = self._extractTableNames(normalizedQuery);
                        
                        if (tableNames.length > 0) {
                            // Try different quoting combinations for table names based on DB type
                            let quotingAttempts = [];
                            
                            switch(dbType) {
                                case 'postgresql':
                                    quotingAttempts = [
                                        (name) => name,                    // no quotes
                                        (name) => `"${name}"`,             // double quotes (PostgreSQL default)
                                    ];
                                    break;
                                case 'mysql':
                                case 'mariadb':
                                    quotingAttempts = [
                                        (name) => name,                    // no quotes
                                        (name) => `\`${name}\``,           // backticks (MySQL default)
                                    ];
                                    break;
                                case 'sqlserver':
                                    quotingAttempts = [
                                        (name) => name,                    // no quotes
                                        (name) => `[${name}]`,             // square brackets (SQL Server default)
                                        (name) => `"${name}"`,             // double quotes
                                    ];
                                    break;
                                default:
                                    quotingAttempts = [
                                        (name) => name,                    // no quotes
                                        (name) => `"${name}"`,             // double quotes
                                        (name) => `'${name}'`,             // single quotes
                                        (name) => `[${name}]`,             // square brackets
                                        (name) => `\`${name}\``,           // backticks
                                    ];
                            }
                            
                            for (const quoteFunc of quotingAttempts) {
                                try {
                                    let modifiedQuery = normalizedQuery;
                                    for (const tableName of tableNames) {
                                        // Replace table name occurrences with quoted version
                                        const regex = new RegExp(`\\b${tableName}\\b`, 'gi');
                                        modifiedQuery = modifiedQuery.replace(regex, quoteFunc(tableName));
                                    }
                                    
                                    logger.info(`'${data.name}' trying query with quoted tables: ${modifiedQuery}`);
                                    const result = await self.connection.query(modifiedQuery);
                                    logger.info(`'${data.name}' query executed successfully with quoting`);
                                    resolve(result);
                                    return;
                                } catch (err) {
                                    logger.warn(`'${data.name}' quoting attempt failed: ${err}`);
                                }
                            }
                        }
                    }
                    
                    // If all attempts failed, reject with the original error
                    reject('Query execution failed with all approaches');
                    
                } else {
                    reject('ODBC connection not established');
                }
            } catch (err) {
                logger.error(`'${data.name}' query error: ${err}`);
                reject(err);
            }
        });
    }

    /**
     * Convert unquoted Date object string representations to ISO format strings
     * Material datepickers output Date objects which JavaScript converts to strings like:
     * "Sat Nov 01 2025 00:00:00 GMT+1300"
     * These need to be converted to ISO format: "2025-11-01 00:00:00"
     * before being processed by the date formatter
     */
    this._formatDateObjectsInQuery = function(query) {
        if (!query || typeof query !== 'string') return query;
        
        // Use the date-formatter module to normalize all date/time values in the query
        // This handles automatic detection and conversion of:
        // - JavaScript Date object toString() format (e.g., "Fri Nov 07 2025 14:31:22 GMT+1300 (New Zealand Daylight Time)")
        // - ISO format (e.g., "2025-01-15", "2025-01-15T14:30:45")
        // - US format (e.g., "01/15/2025", "01/15/2025 14:30:45")
        // - EU format (e.g., "15/01/2025", "15/01/2025 14:30:45")
        
        try {
            const normalized = dateFormatter.normalizeQuery(query);
            if (normalized !== query) {
                logger.info(`'${data.name}' normalized query with date/time formatting`);
            }
            return normalized;
        } catch (err) {
            logger.warn(`'${data.name}' date formatting error: ${err.message}, returning original query`);
            return query;
        }
    }

    /**
     * Execute SQLite-like query by translating to the target database syntax
     */
    this.executeSqliteQuery = function (sqliteQuery, params = []) {
        var self = this;
        return new Promise(async function (resolve, reject) {
            const dbType = self._getDBType();
            const translatedQuery = self._translateSqliteToDb(sqliteQuery, dbType);
            try {
                const result = await self.connection.query(translatedQuery, params);
                resolve(result);
            } catch (err) {
                logger.error(`'${data.name}' executeSqliteQuery error: ${err.message}, stack: ${err.stack}`);
                reject(err);
            }
        });
    }

    /**
     * Translate SQLite query to target database syntax
     */
    this._translateSqliteToDb = function (sqliteQuery, dbType) {
        let query = sqliteQuery;

        // Replace AUTOINCREMENT
        if (dbType === 'postgresql') {
            query = query.replace(/AUTOINCREMENT/g, 'SERIAL');
            query = query.replace(/DATETIME/g, 'TIMESTAMP');
            // Handle INSERT OR REPLACE -> INSERT ... ON CONFLICT
            if (query.trim().startsWith('INSERT OR REPLACE INTO')) {
                const match = query.match(/INSERT OR REPLACE INTO (\w+) \(([^)]+)\) VALUES \(([^)]+)\)/);
                if (match) {
                    const table = match[1];
                    const columns = match[2];
                    const values = match[3];
                    query = `INSERT INTO ${table} (${columns}) VALUES (${values}) ON CONFLICT (id) DO UPDATE SET ${columns.split(',').map(col => col.trim() + ' = EXCLUDED.' + col.trim()).join(', ')}`;
                }
            }
        } else if (dbType === 'mysql' || dbType === 'mariadb') {
            query = query.replace(/AUTOINCREMENT/g, 'AUTO_INCREMENT');
        } else if (dbType === 'mssql') {
            query = query.replace(/AUTOINCREMENT/g, 'IDENTITY(1,1)');
        }

        return query;
    }

    /**
     * Extract table names from SQL query
     */
    this._extractTableNames = function(query) {
        const tableNames = [];
        const fromMatch = query.match(/FROM\s+([`\[\]"'`\w]+)/i);
        if (fromMatch) {
            tableNames.push(fromMatch[1].replace(/[`\[\]"'`]/g, '')); // Remove any existing quotes
        }
        
        // Also check for JOIN clauses
        const joinMatches = query.match(/JOIN\s+([`\[\]"'`\w]+)/gi);
        if (joinMatches) {
            joinMatches.forEach(match => {
                const tableMatch = match.match(/JOIN\s+([`\[\]"'`\w]+)/i);
                if (tableMatch) {
                    tableNames.push(tableMatch[1].replace(/[`\[\]"'`]/g, ''));
                }
            });
        }
        
        return [...new Set(tableNames)]; // Remove duplicates
    }

    /**
     * Extract column types from the query
     * For now, attempts to identify date/time columns from common naming patterns
     * Can be enhanced to use actual schema metadata if available
     * Searches in WHERE, UPDATE SET, and INSERT column lists
     * 
     * @param {string} query - SQL query string
     * @returns {object} - Map of column names to detected types
     */
    this._extractColumnTypesFromQuery = function(query) {
        const columnTypes = {};
        
        // Common date/time column name patterns
        const datePatterns = [
            /\b(date|created_date|updated_date|birth_date|start_date|end_date|effective_date)\b/gi,
            /\b([\w]*_date|[\w]*date[\w]*)\b/gi
        ];
        
        const timePatterns = [
            /\b(time|created_time|updated_time|start_time|end_time|effective_time)\b/gi,
            /\b([\w]*_time|[\w]*time[\w]*)\b/gi
        ];
        
        const timestampPatterns = [
            /\b(timestamp|created_at|updated_at|ts|created_timestamp|updated_timestamp)\b/gi,
            /\b([\w]*_ts|[\w]*_timestamp)\b/gi
        ];
        
        const datetimePatterns = [
            /\b(datetime|modified_datetime|updated_datetime)\b/gi,
            /\b([\w]*_datetime)\b/gi
        ];
        
        // Helper function to check column name against patterns
        const checkColumnName = (columnName) => {
            // DATETIME/TIMESTAMP patterns are more specific, check these first
            for (const pattern of datetimePatterns) {
                if (pattern.test(columnName)) return 'DATETIME';
            }
            for (const pattern of timestampPatterns) {
                if (pattern.test(columnName)) return 'TIMESTAMP';
            }
            // DATE patterns
            for (const pattern of datePatterns) {
                if (pattern.test(columnName)) return 'DATE';
            }
            // TIME patterns - but if it has any date-like suffix, it's likely TIMESTAMP not pure TIME
            // Examples: "time" alone = could be TIMESTAMP, "insert_time" = likely TIMESTAMP, "created_time" = likely TIMESTAMP
            for (const pattern of timePatterns) {
                if (pattern.test(columnName)) {
                    // If it contains phrases like 'created', 'updated', 'insert', 'modified' it's likely a timestamp
                    if (/\b(created|updated|insert|modified|start|end)\b/i.test(columnName)) {
                        return 'TIMESTAMP';
                    }
                    // Generic "time" column or other time patterns - default to TIMESTAMP for safety
                    return 'TIMESTAMP';
                }
            }
            return null;
        };
        
        // Extract from WHERE clause
        const whereMatch = query.match(/WHERE\s+(.+?)(?:GROUP BY|ORDER BY|LIMIT|$)/i);
        if (whereMatch) {
            const whereClause = whereMatch[1];
            const columnMatches = whereClause.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*[=<>]/g);
            if (columnMatches) {
                columnMatches.forEach(match => {
                    const columnName = match.replace(/\s*[=<>].*/, '').trim();
                    const type = checkColumnName(columnName);
                    if (type) columnTypes[columnName] = type;
                });
            }
        }
        
        // Extract from UPDATE SET clause
        const updateMatch = query.match(/UPDATE\s+[\w.]+\s+SET\s+(.+?)(?:WHERE|$)/i);
        if (updateMatch) {
            const setClause = updateMatch[1];
            const columnMatches = setClause.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g);
            if (columnMatches) {
                columnMatches.forEach(match => {
                    const columnName = match.replace(/\s*=.*/, '').trim();
                    const type = checkColumnName(columnName);
                    if (type) columnTypes[columnName] = type;
                });
            }
        }
        
        // Extract from INSERT column list
        const insertMatch = query.match(/INSERT\s+INTO\s+[\w.]+\s*\(([^)]+)\)/i);
        if (insertMatch) {
            const columnList = insertMatch[1];
            const columns = columnList.split(',').map(c => c.trim());
            columns.forEach(columnName => {
                const type = checkColumnName(columnName);
                if (type) columnTypes[columnName] = type;
            });
        }
        
        return columnTypes;
    }

    /**
     * Read values in polling mode 
     * Update the tags values list, save in DAQ if value changed or in interval and emit values to clients
     */
    this.polling = function () {
        if (_checkWorking(true)) {
            if (this.isConnected()) {
                try {
                    _checkWorking(false);
                    lastTimestampValue = new Date().getTime();
                } catch (err) {
                    logger.error(`'${data.name}' polling error: ${err}`);
                    _checkWorking(false);
                }
            } else {
                _checkWorking(false);
            }
        }
    }

    /**
     * Load Tags attribute to read with polling
     */
    this.load = function (_data) {
        data = JSON.parse(JSON.stringify(_data));
        logger.info(`'${data.name}' data loaded`, true);
    }

    /**
     * Return Tags values array { id: <name>, value: <value> }
     */
    this.getValues = function () {
        console.error('Not supported!');
    }

    /**
     * Return Tag value { id: <name>, value: <value>, ts: <lastTimestampValue> }
     */
    this.getValue = function (tagid) {
        console.error('Not supported!');
    }

    /**
     * Return connection status 'connect-off', 'connect-ok', 'connect-error', 'connect-busy'
     */
    this.getStatus = function () {
        return lastStatus;
    }

    /**
     * Return Tag property to show in frontend
     */
    this.getTagProperty = function (tagid) {
        console.error('Not supported!');
    }

    /**
     * Set the Tag value to device
     */
    this.setValue = function (tagid, value) {
        console.error('Not supported!');
    }

    /**
     * Return if device is connected
     */
    this.isConnected = function () {
        return (this.connection) ? this.connection.connected : false;
    }

    /**
     * Bind the DAQ store function and default daqInterval value in milliseconds
     */
    this.bindAddDaq = function (fnc) {
        this.addDaq = fnc;                         // Add the DAQ value to db history
    }

    /**
     * Return the timestamp of last read tag operation on polling
     * @returns 
     */
    this.lastReadTimestamp = () => {
        return lastTimestampValue;
    }

    /**
     * Set function to ask property (security)
     */
    this.bindGetProperty = function (fnc) {
        getProperty = fnc;
    }

    /**
     * Used to manage the async connection and polling automation (that not overloading)
     * @param {*} check 
     */
    var _checkWorking = function (check) {
        if (check && working) {
            overloading++;
            logger.warn(`'${data.name}' working (connection || polling) overload! ${overloading}`);
            // !The driver don't give the break connection
            if (overloading >= 3) {
                try {
                    this.disconnect();
                } catch (e) {
                    console.error(e);
                }
            } else {
                return false;
            }
        }
        working = check;
        overloading = 0;
        return true;
    }

    /**
     * Emit the odbc connection status
     * @param {*} status 
     */
    var _emitStatus = function (status) {
        lastStatus = status;
        events.emit('device-status:changed', { id: data.id, status: status });
    }
}

/**
 * Return tables list
 */
function getTables(endpoint, fncGetProperty, packagerManager) {
    return new Promise( async function (resolve, reject) {
        if (loadOdbcLib(packagerManager)) { 
            var connection;
            try {
                var security
                await fncGetProperty({query: 'security', name: endpoint.id}).then((result, error) => {
                    if (result) {
                        security = utils.JsonTryToParse(result.value);
                    }
                });
                var connectionsString = endpoint.address;
                if (endpoint.uid || security.uid) {
                    connectionsString += `;UID=${endpoint.uid || security.uid}`;
                }
                if (endpoint.pwd || security.pwd) {
                    connectionsString += `;PWD=${endpoint.pwd || security.pwd}`;
                }
                const connectionConfig = {
                    connectionString: connectionsString,
                    connectionTimeout: 10,
                    loginTimeout: 10,
                }
                connection = await odbc.connect(connectionConfig)
                var tables = await connection.tables(null, 'dbo', null, null);
                console.log(`'${endpoint.name}' found ${tables.length} tables with dbo schema`);
                if (tables.length <= 0) {
                    tables = await connection.tables(null, null, null, null);
                    console.log(`'${endpoint.name}' found ${tables.length} tables with null schema`);
                }
                if (tables.length <= 0) {
                    tables = await connection.tables(null, 'public', null, null);
                    console.log(`'${endpoint.name}' found ${tables.length} tables with public schema`);
                }
                const resultEndpoints = tables.map(table => table.TABLE_NAME);
                console.log(`'${endpoint.name}' returning tables: ${resultEndpoints.join(', ')}`);
                resolve(resultEndpoints);
            } catch (err) {
                reject('getendpoints-error: ' + err);
            }
            if (connection) {
                connection.close();
            }
        } else {
            reject('getendpoints-error: odbc not found!');
        }
    });
}

function loadOdbcLib(manager) {
    if (!odbc) {
        try { odbc = require('odbc'); } catch { }
        if (!odbc && manager) { try { odbc = manager.require('odbc'); } catch { } }
    }
    return (odbc) ? true : false;
}

module.exports = {
    init: function (settings) {
        // deviceCloseTimeout = settings.deviceCloseTimeout || 15000;
    },
    create: function (data, logger, events, manager) {
        if (!loadOdbcLib(manager)) return null;
        return new ODBCclient(data, logger, events);
    },
    getTables: getTables
}