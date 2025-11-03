import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';
import { Device, DeviceType } from '../_models/device';
import { ProjectService } from '../_services/project.service';
import { HmiService } from '../_services/hmi.service';
import { QueryBuilderService, QueryBuilderConfig } from './query-builder.service';
import { Subscription } from 'rxjs';

export interface OdbcBrowserData {
  deviceId?: string;
  query?: string;
  selectColumn?: boolean;
  preselectedTable?: string; // Pre-select a specific table for column selection
}

export interface QueryResult {
  columns: string[];
  rows: any[];
  rowCount: number;
}

export interface ColumnDefinition {
  name: string;
  type: string;
  nullable?: boolean;
  defaultValue?: string;
  autoIncrement?: boolean;
  autoTimestamp?: boolean; // DEFAULT CURRENT_TIMESTAMP
  isPrimaryKey?: boolean;
  foreignKey?: {
    tableName: string;
    columnName: string;
  };
}

export interface SqlSyntaxItem {
  name: string;
  description: string;
  syntax: string;
}

@Component({
  selector: 'app-odbc-browser',
  templateUrl: './odbc-browser.component.html',
  styleUrls: ['./odbc-browser.component.css']
})
export class OdbcBrowserComponent implements OnInit, OnDestroy {

  // Tab management
  selectedTabIndex = 0;
  
  // Device & Table Selection
  devices: Device[] = [];
  selectedDevice: Device = null;
  tables: string[] = [];
  selectedTable: string = '';
  columns: any[] = [];
  selectedColumns: string[] = [];
  selectedColumn: string = '';
  
  // Data Viewer
  tableData: QueryResult = { columns: [], rows: [], rowCount: 0 };
  rowLimit = 10;
  rowLimitOptions = [10, 50, 100, 500];
  displayedColumns: string[] = [];
  
  // SQL Query Editor
  sqlQuery: string = '';
  customSqlQuery: string = '';
  sqlExecutionResult: QueryResult = { columns: [], rows: [], rowCount: 0 };
  sqlExecutionError: string = '';
  
  // Table Creator
  newTableName: string = '';
  newTableColumns: ColumnDefinition[] = [];
  primaryKeyColumn: string = '';
  foreignKeyColumn: string = '';  // Column that has the FK
  foreignKeyReferencedTable: string = '';  // Table being referenced
  foreignKeyReferencedColumn: string = '';  // Column being referenced
  foreignKeyReferencedTableColumns: string[] = [];  // Columns of selected FK table
  selectedDataType: string = 'VARCHAR(255)';
  dataTypeOptions = [
    // String types
    'VARCHAR(255)',
    'TEXT',
    'CHAR(10)',
    'UUID',
    'JSON',
    'JSONB',
    // Numeric types
    'INTEGER',
    'BIGINT',
    'SMALLINT',
    'FLOAT',
    'REAL',
    'DECIMAL(10,2)',
    'NUMERIC(10,2)',
    // Auto-increment types (for PRIMARY KEY)
    'SERIAL',
    'BIGSERIAL',
    'SMALLSERIAL',
    // Date/Time types
    'DATE',
    'TIME',
    'TIMESTAMP',
    'TIMESTAMP WITH TIME ZONE',
    'TIMESTAMP WITHOUT TIME ZONE',
    // Boolean and other
    'BOOLEAN',
    'ENUM',
    'ARRAY',
    'BYTEA'
  ];
  
  // Table Management
  isEditingTable: boolean = false;
  editingTableName: string = '';
  originalTableName: string = '';
  originalTableColumns: ColumnDefinition[] = [];
  originalPrimaryKeyColumn: string = '';
  generatedQuery: string = '';
  showQueryPreview: boolean = false;
  deleteConfirmation: { show: boolean; tableName: string } = { show: false, tableName: '' };
  
  // Query Builder
  queryBuilderConfig: QueryBuilderConfig;
  queryBuilderResults: QueryResult = null;
  availableColumns: Array<{ name: string; type: string; selected: boolean; aggregate?: string }> = [];
  queryBuilderSelectAll: boolean = false;
  queryBuilderConditionOperators: string[] = [];
  
  // State flags
  loading = false;
  error = '';
  success = '';
  selectColumnMode = false;
  tableCreationMode = false;
  showHelpDialog = false;

  // SQL Syntax Reference
  sqlSyntaxReference: SqlSyntaxItem[] = [
    {
      name: 'SELECT',
      description: 'Retrieves data from one or more tables. The most fundamental SQL command.',
      syntax: 'SELECT column_name(s)\nFROM table_name'
    },
    {
      name: 'SELECT *',
      description: 'Retrieves all columns from a table.',
      syntax: 'SELECT *\nFROM table_name'
    },
    {
      name: 'SELECT DISTINCT',
      description: 'Returns only distinct (different) values from a column.',
      syntax: 'SELECT DISTINCT column_name(s)\nFROM table_name'
    },
    {
      name: 'WHERE',
      description: 'Filters records based on specified conditions.',
      syntax: 'SELECT column_name(s)\nFROM table_name\nWHERE column_name operator value'
    },
    {
      name: 'AND / OR',
      description: 'Combines multiple conditions. AND requires all conditions to be true, OR requires at least one.',
      syntax: 'SELECT column_name(s)\nFROM table_name\nWHERE condition\nAND|OR condition'
    },
    {
      name: 'BETWEEN',
      description: 'Selects values within a given range (inclusive).',
      syntax: 'SELECT column_name(s)\nFROM table_name\nWHERE column_name\nBETWEEN value1 AND value2'
    },
    {
      name: 'IN',
      description: 'Specifies multiple values for a WHERE clause.',
      syntax: 'SELECT column_name(s)\nFROM table_name\nWHERE column_name\nIN (value1,value2,..)'
    },
    {
      name: 'LIKE',
      description: 'Searches for a specified pattern in a column.',
      syntax: 'SELECT column_name(s)\nFROM table_name\nWHERE column_name LIKE pattern'
    },
    {
      name: 'ORDER BY',
      description: 'Sorts results in ascending (ASC) or descending (DESC) order.',
      syntax: 'SELECT column_name(s)\nFROM table_name\nORDER BY column_name [ASC|DESC]'
    },
    {
      name: 'GROUP BY',
      description: 'Groups rows with the same values and is often used with aggregate functions.',
      syntax: 'SELECT column_name, aggregate_function(column_name)\nFROM table_name\nGROUP BY column_name'
    },
    {
      name: 'HAVING',
      description: 'Like WHERE but filters groups instead of rows (used after GROUP BY).',
      syntax: 'SELECT column_name, aggregate_function(column_name)\nFROM table_name\nGROUP BY column_name\nHAVING aggregate_function(column_name) operator value'
    },
    {
      name: 'INSERT INTO',
      description: 'Inserts new records/rows into a table.',
      syntax: 'INSERT INTO table_name\n(column1, column2, column3,...)\nVALUES (value1, value2, value3,....)'
    },
    {
      name: 'UPDATE',
      description: 'Modifies existing records in a table.',
      syntax: 'UPDATE table_name\nSET column1=value, column2=value,...\nWHERE some_column=some_value'
    },
    {
      name: 'DELETE',
      description: 'Removes records from a table. Use WHERE to specify which records to delete.',
      syntax: 'DELETE FROM table_name\nWHERE some_column=some_value'
    },
    {
      name: 'CREATE TABLE',
      description: 'Creates a new table in the database.',
      syntax: 'CREATE TABLE table_name\n(\ncolumn_name1 data_type,\ncolumn_name2 data_type,\ncolumn_name3 data_type,\n...\n)'
    },
    {
      name: 'ALTER TABLE',
      description: 'Modifies the structure of an existing table (add/drop columns).',
      syntax: 'ALTER TABLE table_name\nADD column_name datatype\nor\nALTER TABLE table_name\nDROP COLUMN column_name'
    },
    {
      name: 'DROP TABLE',
      description: 'Completely removes a table from the database.',
      syntax: 'DROP TABLE table_name'
    },
    {
      name: 'TRUNCATE TABLE',
      description: 'Removes all records from a table but keeps the structure.',
      syntax: 'TRUNCATE TABLE table_name'
    },
    {
      name: 'CREATE INDEX',
      description: 'Creates an index on one or more columns to improve query performance.',
      syntax: 'CREATE INDEX index_name\nON table_name (column_name)\nor\nCREATE UNIQUE INDEX index_name\nON table_name (column_name)'
    },
    {
      name: 'DROP INDEX',
      description: 'Removes an index from a table.',
      syntax: 'DROP INDEX index_name'
    },
    {
      name: 'INNER JOIN',
      description: 'Returns records that have matching values in both tables.',
      syntax: 'SELECT column_name(s)\nFROM table_name1\nINNER JOIN table_name2\nON table_name1.column_name=table_name2.column_name'
    },
    {
      name: 'LEFT JOIN',
      description: 'Returns all records from the left table, and matched records from the right table.',
      syntax: 'SELECT column_name(s)\nFROM table_name1\nLEFT JOIN table_name2\nON table_name1.column_name=table_name2.column_name'
    },
    {
      name: 'RIGHT JOIN',
      description: 'Returns all records from the right table, and matched records from the left table.',
      syntax: 'SELECT column_name(s)\nFROM table_name1\nRIGHT JOIN table_name2\nON table_name1.column_name=table_name2.column_name'
    },
    {
      name: 'FULL JOIN',
      description: 'Returns all records when there is a match in either the left or right table.',
      syntax: 'SELECT column_name(s)\nFROM table_name1\nFULL JOIN table_name2\nON table_name1.column_name=table_name2.column_name'
    },
    {
      name: 'UNION',
      description: 'Combines results from multiple SELECT statements (removes duplicates).',
      syntax: 'SELECT column_name(s) FROM table_name1\nUNION\nSELECT column_name(s) FROM table_name2'
    },
    {
      name: 'UNION ALL',
      description: 'Combines results from multiple SELECT statements (includes duplicates).',
      syntax: 'SELECT column_name(s) FROM table_name1\nUNION ALL\nSELECT column_name(s) FROM table_name2'
    },
    {
      name: 'AS (alias)',
      description: 'Gives a temporary name to a column or table (useful for readability).',
      syntax: 'SELECT column_name AS column_alias\nFROM table_name\nor\nSELECT column_name\nFROM table_name AS table_alias'
    },
    {
      name: 'CREATE VIEW',
      description: 'Creates a virtual table based on a SELECT query.',
      syntax: 'CREATE VIEW view_name AS\nSELECT column_name(s)\nFROM table_name\nWHERE condition'
    },
    {
      name: 'CREATE DATABASE',
      description: 'Creates a new database.',
      syntax: 'CREATE DATABASE database_name'
    },
    {
      name: 'DROP DATABASE',
      description: 'Removes a database and all its contents.',
      syntax: 'DROP DATABASE database_name'
    },
    {
      name: 'SELECT TOP',
      description: 'Limits the number of records returned in the result set.',
      syntax: 'SELECT TOP number|percent column_name(s)\nFROM table_name'
    },
    {
      name: 'SELECT INTO',
      description: 'Copies data from one table to a new table.',
      syntax: 'SELECT column_name(s)\nINTO new_table_name\nFROM old_table_name'
    },
    {
      name: 'EXISTS',
      description: 'Tests whether a subquery returns any rows.',
      syntax: 'IF EXISTS (SELECT * FROM table_name WHERE id = ?)\nBEGIN\n--do what needs to be done if exists\nEND\nELSE\nBEGIN\n--do what needs to be done if not\nEND'
    }
  ];

  
  // Subscriptions
  private subscriptions: Subscription[] = [];
  private browseSubscription: Subscription;
  private propertySubscription: Subscription;

  constructor(
    private projectService: ProjectService,
    private hmiService: HmiService,
    private queryBuilderService: QueryBuilderService,
    public dialogRef: MatDialogRef<OdbcBrowserComponent>,
    @Inject(MAT_DIALOG_DATA) public data: OdbcBrowserData
  ) {
    this.queryBuilderConfig = this.queryBuilderService.createEmptyConfig();
  }

  ngOnInit() {
    this.devices = (<Device[]>Object.values(this.projectService.getDevices()))
      .filter(d => d.type === DeviceType.ODBC);

    if (this.data.deviceId) {
      this.selectedDevice = this.devices.find(d => d.id === this.data.deviceId);
      // Auto-load tables if device is pre-selected
      if (this.selectedDevice) {
        this.loadTables();
      }
    }

    this.selectColumnMode = this.data.selectColumn || false;
  }

  ngOnDestroy() {
    // Unsubscribe from all active subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.browseSubscription) {
      this.browseSubscription.unsubscribe();
    }
    if (this.propertySubscription) {
      this.propertySubscription.unsubscribe();
    }
  }

  onDeviceChange() {
    if (this.selectedDevice) {
      this.loadTables();
    } else {
      this.tables = [];
      this.selectedTable = '';
      this.columns = [];
      this.selectedColumns = [];
    }
  }

  loadTables() {
    if (!this.selectedDevice) return;

    this.loading = true;
    this.error = '';
    this.tables = [];
    this.selectedTable = '';
    this.columns = [];
    this.selectedColumns = [];

    // Use the existing askDeviceProperty to get tables
    this.hmiService.askDeviceProperty({
      address: this.selectedDevice.property?.address,
      uid: null, // Will be filled from security if needed
      pwd: null
    }, DeviceType.ODBC);

    // Listen for the response
    this.propertySubscription = this.hmiService.onDeviceProperty.subscribe(result => {
      if (result && result.type === DeviceType.ODBC && result.result) {
        this.tables = result.result;
        this.loading = false;
        
        // If a table is pre-selected, select and load it
        if (this.data.preselectedTable && this.tables.includes(this.data.preselectedTable)) {
          this.selectedTable = this.data.preselectedTable;
          this.loadColumns();
        }
        
        if (this.propertySubscription) {
          this.propertySubscription.unsubscribe();
        }
      } else if (result && result.type === DeviceType.ODBC && result.error) {
        this.error = result.error;
        this.loading = false;
        if (this.propertySubscription) {
          this.propertySubscription.unsubscribe();
        }
      }
    });
    this.subscriptions.push(this.propertySubscription);
  }

  onTableSelect(table: string) {
    console.log('ODBC Browser: Table selected:', table);
    this.selectedTable = table;
    this.selectedColumns = [];
    this.sqlQuery = '';
    this.tableData = { columns: [], rows: [], rowCount: 0 };
    this.loadColumns();
  }

  loadColumns() {
    console.log('ODBC Browser: loadColumns called. Device:', this.selectedDevice?.id, 'Table:', this.selectedTable);
    if (!this.selectedDevice || !this.selectedTable) {
      console.warn('ODBC Browser: Missing device or table, returning');
      return;
    }

    this.loading = true;
    this.error = '';
    this.columns = [];
    this.selectedColumns = [];

    // Unsubscribe from any previous subscription
    if (this.browseSubscription) {
      this.browseSubscription.unsubscribe();
    }

    this.browseSubscription = this.hmiService.onDeviceBrowse.subscribe(result => {
      if (result && Array.isArray(result)) {
        // Direct array response (from callback)
        console.log('ODBC Browser: Columns received (direct):', result);
        this.columns = result.map(col => ({
          name: col.id || col.name,
          type: col.type || 'string'
        }));
        console.log('ODBC Browser: Mapped columns:', this.columns);
        this.loading = false;
      } else if (result && result.result && Array.isArray(result.result)) {
        // Object with result property containing array
        console.log('ODBC Browser: Columns received (wrapped):', result.result);
        this.columns = result.result.map(col => ({
          name: col.id || col.name,
          type: col.type || 'string'
        }));
        console.log('ODBC Browser: Mapped columns:', this.columns);
        this.loading = false;
      } else if (result && result.error) {
        console.error('ODBC Browser: Error loading columns:', result.error);
        this.error = result.error;
        this.loading = false;
      }
    });

    console.log('ODBC Browser: Requesting columns for table:', this.selectedTable);
    this.hmiService.askDeviceBrowse(this.selectedDevice.id, this.selectedTable);
  }

  onColumnToggle(column: string, checked: boolean) {
    if (this.selectColumnMode) {
      // Single selection mode for timestamp column
      this.selectedColumn = checked ? column : '';
    } else {
      // Multiple selection mode for query building
      if (checked) {
        if (!this.selectedColumns.includes(column)) {
          this.selectedColumns.push(column);
          this.updateSqlQuery();
        }
      } else {
        this.selectedColumns = this.selectedColumns.filter(c => c !== column);
        this.updateSqlQuery();
      }
    }
  }

  updateSqlQuery() {
    if (this.selectedColumns.length > 0) {
      const columns = this.selectedColumns.join(', ');
      this.sqlQuery = `SELECT ${columns} FROM ${this.selectedTable}`;
    } else {
      this.sqlQuery = '';
    }
  }

  generateQuery(): string {
    return this.sqlQuery;
  }

  copyQueryToSqlEditor(): void {
    if (this.sqlQuery) {
      this.customSqlQuery = this.sqlQuery;
      this.selectedTabIndex = 3; // Switch to SQL Editor tab
    }
  }

  // Data Viewer Methods
  loadTableData() {
    if (!this.selectedDevice || !this.selectedTable || this.selectedColumns.length === 0) {
      this.error = 'Please select table and columns first';
      return;
    }

    this.loading = true;
    this.error = '';
    const query = `SELECT ${this.selectedColumns.join(', ')} FROM ${this.selectedTable} LIMIT ${this.rowLimit}`;
    console.log('ODBC Browser: Loading table data with query:', query);
    
    // Create a subscription to listen for ODBC query results
    const querySubscription = this.hmiService.onDeviceOdbcQuery.subscribe(result => {
      console.log('ODBC Browser: Query result received:', result);
      if (result && result.result && Array.isArray(result.result)) {
        console.log('ODBC Browser: Found result array:', result.result);
        this.tableData = {
          columns: this.selectedColumns,
          rows: result.result || [],
          rowCount: result.result?.length || 0
        };
        this.displayedColumns = this.selectedColumns;
        console.log('ODBC Browser: Table data set:', this.tableData);
      } else if (result && result.error) {
        console.error('ODBC Browser: Query error:', result.error);
        this.error = result.error;
      } else {
        console.warn('ODBC Browser: Unexpected result format:', result);
      }
      this.loading = false;
      if (querySubscription) {
        querySubscription.unsubscribe();
      }
    });
    this.subscriptions.push(querySubscription);

    // Execute the query through ODBC device
    this.hmiService.executeOdbcQuery(this.selectedDevice.id, query);
  }

  onRowLimitChange() {
    this.loadTableData();
  }

  // SQL Editor Methods
  executeSqlQuery() {
    if (!this.selectedDevice || !this.customSqlQuery.trim()) {
      this.sqlExecutionError = 'Please enter a SQL query';
      return;
    }

    this.loading = true;
    this.sqlExecutionError = '';
    this.success = '';
    
    // Create a subscription to listen for ODBC query results
    const querySubscription = this.hmiService.onDeviceOdbcQuery.subscribe(result => {
      if (result && Array.isArray(result)) {
        // Direct array response
        const rows = result;
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        this.sqlExecutionResult = {
          columns: columns,
          rows: rows,
          rowCount: rows.length
        };
        this.success = 'Query executed successfully!';
        setTimeout(() => this.success = '', 4000);
      } else if (result && result.result && Array.isArray(result.result)) {
        // Wrapped array response
        const rows = result.result;
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        this.sqlExecutionResult = {
          columns: columns,
          rows: rows,
          rowCount: rows.length
        };
        this.success = 'Query executed successfully!';
        setTimeout(() => this.success = '', 4000);
      } else if (result && result.result && result.result.columns) {
        // Response with explicit columns property
        this.sqlExecutionResult = {
          columns: result.result.columns || [],
          rows: result.result.rows || [],
          rowCount: result.result.rows?.length || 0
        };
        this.success = 'Query executed successfully!';
        setTimeout(() => this.success = '', 4000);
      } else if (result && result.error) {
        this.sqlExecutionError = result.error;
      }
      this.loading = false;
      if (querySubscription) {
        querySubscription.unsubscribe();
      }
    });
    this.subscriptions.push(querySubscription);

    // Execute the custom query
    this.hmiService.executeOdbcQuery(this.selectedDevice.id, this.customSqlQuery);
  }

  copySqlQuery() {
    const textArea = document.createElement('textarea');
    textArea.value = this.sqlQuery;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }

  clearSqlEditor() {
    this.customSqlQuery = '';
    this.sqlExecutionResult = { columns: [], rows: [], rowCount: 0 };
    this.sqlExecutionError = '';
  }

  // Table Creator Methods
  addColumnField() {
    this.newTableColumns.push({
      name: '',
      type: 'VARCHAR(255)',
      nullable: true
    });
  }

  removeColumnField(index: number) {
    this.newTableColumns.splice(index, 1);
  }

  createTable() {
    if (!this.selectedDevice || !this.newTableName.trim()) {
      this.error = 'Please provide a table name';
      return;
    }

    if (this.newTableColumns.length === 0) {
      this.error = 'Please add at least one column';
      return;
    }

    const columns = this.newTableColumns.map(col => {
      let columnDef = `${col.name} ${col.type}`;
      
      // Add AUTO_INCREMENT if enabled
      if (col.autoIncrement) {
        columnDef += ' AUTO_INCREMENT';
      }
      
      // Add DEFAULT CURRENT_TIMESTAMP if enabled (before NOT NULL)
      if (col.autoTimestamp) {
        columnDef += ' DEFAULT CURRENT_TIMESTAMP';
      }
      
      // Add NOT NULL constraint
      if (!col.nullable) {
        columnDef += ' NOT NULL';
      }
      
      // Add DEFAULT VALUE if provided (and not using autoTimestamp)
      if (col.defaultValue && !col.autoTimestamp) {
        columnDef += ` DEFAULT '${col.defaultValue}'`;
      }
      
      return columnDef;
    }).join(', ');

    let primaryKeyClause = '';
    if (this.primaryKeyColumn) {
      primaryKeyClause = `, PRIMARY KEY (${this.primaryKeyColumn})`;
    }

    // Generate the query and display it instead of executing immediately
    if (this.isEditingTable) {
      // For ALTER TABLE, build the appropriate statement
      this.generatedQuery = this.generateAlterTableQuery();
    } else {
      // For CREATE TABLE
      this.generatedQuery = `CREATE TABLE ${this.newTableName} (${columns}${primaryKeyClause})`;
    }

    this.showQueryPreview = true;
    this.error = '';
  }

  /**
   * Generate ALTER TABLE query for editing existing tables
   */
  generateAlterTableQuery(): string {
    // Generate clean standard SQL - the ODBC server driver will normalize for the specific database
    let alterQueries = [];
    const tableName = this.newTableName || this.originalTableName;
    
    // 1. Handle table rename
    if (this.newTableName !== this.originalTableName && this.originalTableName) {
      alterQueries.push(`ALTER TABLE ${this.originalTableName} RENAME TO ${this.newTableName};`);
    }
    
    // 2. Detect column additions, deletions, and modifications
    const originalColMap = new Map(this.originalTableColumns.map(c => [c.name, c]));
    const newColMap = new Map(this.newTableColumns.map(c => [c.name, c]));
    
    // Detect deleted columns
    for (const [colName, originalCol] of originalColMap.entries()) {
      if (!newColMap.has(colName)) {
        alterQueries.push(`ALTER TABLE ${tableName} DROP COLUMN ${colName};`);
      }
    }
    
    // Detect new columns and modified columns
    for (const [colName, newCol] of newColMap.entries()) {
      const originalCol = originalColMap.get(colName);
      
      if (!originalCol) {
        // New column added - server normalizes types
        let columnDef = `${colName} ${newCol.type}`;
        
        // Add AUTO_INCREMENT if enabled
        if (newCol.autoIncrement) {
          columnDef += ' AUTO_INCREMENT';
        }
        
        // Add DEFAULT CURRENT_TIMESTAMP if enabled (before NOT NULL)
        if (newCol.autoTimestamp) {
          columnDef += ' DEFAULT CURRENT_TIMESTAMP';
        }
        
        if (!newCol.nullable) {
          columnDef += ' NOT NULL';
        }
        if (newCol.defaultValue && !newCol.autoTimestamp) {
          columnDef += ` DEFAULT '${newCol.defaultValue}'`;
        }
        alterQueries.push(`ALTER TABLE ${tableName} ADD COLUMN ${columnDef};`);
      } else if (originalCol.type !== newCol.type || originalCol.nullable !== newCol.nullable || originalCol.defaultValue !== newCol.defaultValue || originalCol.autoIncrement !== newCol.autoIncrement || originalCol.autoTimestamp !== newCol.autoTimestamp) {
        // Column was modified - server normalizes types
        let columnDef = `${colName} ${newCol.type}`;
        
        // Add AUTO_INCREMENT if enabled
        if (newCol.autoIncrement) {
          columnDef += ' AUTO_INCREMENT';
        }
        
        // Add DEFAULT CURRENT_TIMESTAMP if enabled (before NOT NULL)
        if (newCol.autoTimestamp) {
          columnDef += ' DEFAULT CURRENT_TIMESTAMP';
        }
        
        if (!newCol.nullable) {
          columnDef += ' NOT NULL';
        }
        if (newCol.defaultValue && !newCol.autoTimestamp) {
          columnDef += ` DEFAULT '${newCol.defaultValue}'`;
        }
        alterQueries.push(`ALTER TABLE ${tableName} MODIFY COLUMN ${columnDef};`);
      }
    }
    
    if (alterQueries.length > 0) {
      return alterQueries.join('\n') + 
             `\n\n-- ODBC Server normalizes types and syntax for your database\n` +
             `-- Table: ${this.originalTableName}\n` +
             `-- Statements: ${alterQueries.length}`;
    } else {
      return `-- No structural changes to apply`;
    }
  }

  /**
   * Execute the generated CREATE/ALTER TABLE query
   */
  executeTableQuery() {
    if (!this.generatedQuery || !this.generatedQuery.trim()) {
      this.error = 'No query to execute';
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';

    // For ALTER TABLE, split by semicolons and execute each statement
    const queries = this.generatedQuery.split(';').filter(q => q.trim() && !q.trim().startsWith('--'));

    const executeQuery = (queryList: string[], index: number = 0) => {
      if (index >= queryList.length) {
        // All queries executed successfully
        this.success = this.isEditingTable ? 'Table updated successfully!' : 'Table created successfully!';
        setTimeout(() => this.success = '', 4000);
        this.newTableName = '';
        this.newTableColumns = [];
        this.primaryKeyColumn = '';
        this.foreignKeyColumn = '';
        this.foreignKeyReferencedTable = '';
        this.foreignKeyReferencedColumn = '';
        this.foreignKeyReferencedTableColumns = [];
        this.tableCreationMode = false;
        this.isEditingTable = false;
        this.showQueryPreview = false;
        this.loadTables();
        this.loading = false;
        return;
      }

      const querySubscription = this.hmiService.onDeviceOdbcQuery.subscribe(result => {
        if (result && result.success !== false && !result.error) {
          // Execute next query
          executeQuery(queryList, index + 1);
        } else if (result && result.error) {
          this.error = result.error;
          this.loading = false;
        }
        if (querySubscription) {
          querySubscription.unsubscribe();
        }
      });
      this.subscriptions.push(querySubscription);

      // Execute the current query
      this.hmiService.executeOdbcQuery(this.selectedDevice.id, queryList[index].trim() + ';');
    };

    executeQuery(queries);
  }

  /**
   * Copy generated query to SQL editor and switch tabs
   */
  copyQueryToSqlEditorFromTableCreator() {
    if (!this.generatedQuery) return;
    this.customSqlQuery = this.generatedQuery;
    this.selectedTabIndex = 3; // Switch to SQL Editor tab
    this.showQueryPreview = false;
  }

  /**
   * Cancel table creation and close preview
   */
  cancelTableCreation() {
    this.newTableName = '';
    this.newTableColumns = [];
    this.primaryKeyColumn = '';
    this.foreignKeyColumn = '';
    this.foreignKeyReferencedTable = '';
    this.foreignKeyReferencedColumn = '';
    this.foreignKeyReferencedTableColumns = [];
    this.originalTableColumns = [];
    this.originalPrimaryKeyColumn = '';
    this.tableCreationMode = false;
    this.isEditingTable = false;
    this.showQueryPreview = false;
  }

  onOkClick() {
    if (this.selectColumnMode) {
      if (this.selectedColumn) {
        this.dialogRef.close({
          deviceId: this.selectedDevice?.id,
          column: this.selectedColumn,
          tableName: this.selectedTable
        });
      }
    } else {
      const query = this.generateQuery();
      if (query) {
        this.dialogRef.close({
          deviceId: this.selectedDevice?.id,
          query: query
        });
      }
    }
  }

  onCancelClick() {
    this.dialogRef.close();
  }

  /**
   * Edit an existing table - load it into the Table Creator for modification
   */
  editTable(tableName: string) {
    if (!this.selectedDevice) {
      this.error = 'No device selected';
      return;
    }

    this.loading = true;
    this.error = '';

    // First, select the table to trigger column loading
    this.selectedTable = tableName;
    this.isEditingTable = true;
    this.editingTableName = tableName;
    this.originalTableName = tableName;
    this.newTableName = tableName;

    // Set up subscription to listen for columns to load
    if (this.browseSubscription) {
      this.browseSubscription.unsubscribe();
    }

    this.browseSubscription = this.hmiService.onDeviceBrowse.subscribe(result => {
      if (result && Array.isArray(result)) {
        // Direct array response
        console.log('ODBC Browser: Edit mode - Columns received (direct):', result);
        this.newTableColumns = result.map(col => ({
          name: col.id || col.name,
          type: col.type || 'VARCHAR(255)',
          nullable: col.nullable !== false,
          defaultValue: col.defaultValue || '',
          autoIncrement: col.isIdentity || false,
          autoTimestamp: col.isAutoTimestamp || false,
          isPrimaryKey: col.isPrimaryKey || false,
          foreignKey: col.foreignKey
        }));
        // Store original columns for change detection
        this.originalTableColumns = JSON.parse(JSON.stringify(this.newTableColumns));
        this.tableCreationMode = true;
        this.selectedTabIndex = 4; // Switch to Create Table tab
        this.loading = false;
      } else if (result && result.result && Array.isArray(result.result)) {
        // Object with result property containing array
        console.log('ODBC Browser: Edit mode - Columns received (wrapped):', result.result);
        this.newTableColumns = result.result.map(col => ({
          name: col.id || col.name,
          type: col.type || 'VARCHAR(255)',
          nullable: col.nullable !== false,
          defaultValue: col.defaultValue || '',
          autoIncrement: col.isIdentity || false,
          autoTimestamp: col.isAutoTimestamp || false,
          isPrimaryKey: col.isPrimaryKey || false,
          foreignKey: col.foreignKey
        }));
        
        // Find and set the primary key column
        const pkCol = result.result.find(col => col.isPrimaryKey);
        if (pkCol) {
          this.primaryKeyColumn = pkCol.id || pkCol.name;
        }
        
        // Store original columns for change detection
        this.originalTableColumns = JSON.parse(JSON.stringify(this.newTableColumns));
        this.tableCreationMode = true;
        this.selectedTabIndex = 4; // Switch to Create Table tab
        this.loading = false;
      } else if (result && result.error) {
        console.error('ODBC Browser: Error loading columns for edit:', result.error);
        this.error = result.error;
        this.loading = false;
      }
    });

    // Trigger column loading
    this.hmiService.askDeviceBrowse(this.selectedDevice.id, tableName);
  }

  /**
   * Delete a table with confirmation
   */
  deleteTable(tableName: string) {
    this.deleteConfirmation = { show: true, tableName: tableName };
  }

  /**
   * Confirm table deletion
   */
  confirmDeleteTable() {
    if (!this.deleteConfirmation.tableName || !this.selectedDevice) {
      this.error = 'Cannot delete table';
      this.deleteConfirmation = { show: false, tableName: '' };
      return;
    }

    const dropTableQuery = `DROP TABLE ${this.deleteConfirmation.tableName}`;
    this.loading = true;
    this.error = '';

    const querySubscription = this.hmiService.onDeviceOdbcQuery.subscribe(result => {
      if (result && result.success !== false && !result.error) {
        // Reload tables after deletion
        this.loadTables();
      } else if (result && result.error) {
        this.error = `Failed to delete table: ${result.error}`;
      }
      this.loading = false;
      this.deleteConfirmation = { show: false, tableName: '' };
      if (querySubscription) {
        querySubscription.unsubscribe();
      }
    });
    this.subscriptions.push(querySubscription);

    this.hmiService.executeOdbcQuery(this.selectedDevice.id, dropTableQuery);
  }

  /**
   * Cancel table deletion
   */
  cancelDeleteTable() {
    this.deleteConfirmation = { show: false, tableName: '' };
  }

  /**
   * Reorder columns in table definition
   */
  moveColumn(fromIndex: number, toIndex: number) {
    if (fromIndex >= 0 && fromIndex < this.newTableColumns.length &&
        toIndex >= 0 && toIndex < this.newTableColumns.length) {
      const [column] = this.newTableColumns.splice(fromIndex, 1);
      this.newTableColumns.splice(toIndex, 0, column);
      // Trigger change detection
      this.newTableColumns = [...this.newTableColumns];
    }
  }

  /**
   * Rename a column
   */
  renameColumn(index: number, newName: string) {
    if (index >= 0 && index < this.newTableColumns.length) {
      this.newTableColumns[index].name = newName;
    }
  }

  /**
   * Update column type
   */
  updateColumnType(index: number, newType: string) {
    if (index >= 0 && index < this.newTableColumns.length) {
      this.newTableColumns[index].type = newType;
    }
  }

  /**
   * Remove a column from the definition
   */
  removeColumn(index: number) {
    if (index >= 0 && index < this.newTableColumns.length) {
      this.newTableColumns.splice(index, 1);
      // If this was the primary key column, clear it
      if (this.primaryKeyColumn === this.newTableColumns[index]?.name) {
        this.primaryKeyColumn = '';
      }
      // Trigger change detection
      this.newTableColumns = [...this.newTableColumns];
    }
  }

  /**
   * Add foreign key constraint to selected column
   */
  addForeignKey() {
    if (this.foreignKeyColumn && this.foreignKeyReferencedTable && this.foreignKeyReferencedColumn) {
      // Find the column and set its foreign key
      const column = this.newTableColumns.find(col => col.name === this.foreignKeyColumn);
      if (column) {
        column.foreignKey = {
          tableName: this.foreignKeyReferencedTable,
          columnName: this.foreignKeyReferencedColumn
        };
        // Trigger change detection
        this.newTableColumns = [...this.newTableColumns];
        // Clear the form
        this.foreignKeyColumn = '';
        this.foreignKeyReferencedTable = '';
        this.foreignKeyReferencedColumn = '';
      }
    }
  }

  /**
   * Clear foreign key constraint from selected column
   */
  clearForeignKey() {
    if (this.foreignKeyColumn) {
      const column = this.newTableColumns.find(col => col.name === this.foreignKeyColumn);
      if (column) {
        column.foreignKey = undefined;
        // Trigger change detection
        this.newTableColumns = [...this.newTableColumns];
        // Clear the form
        this.foreignKeyColumn = '';
        this.foreignKeyReferencedTable = '';
        this.foreignKeyReferencedColumn = '';
      }
    }
  }

  /**
   * Load columns for the selected foreign key table
   */
  onForeignKeyTableSelected(tableName: string) {
    if (tableName) {
      // Reset column selection
      this.foreignKeyReferencedColumn = '';
      // Ask for columns of the selected table
      this.hmiService.askDeviceBrowse(this.selectedDevice.id, tableName);
      
      // Subscribe to get the columns
      if (this.browseSubscription) {
        this.browseSubscription.unsubscribe();
      }
      
      this.browseSubscription = this.hmiService.onDeviceBrowse.subscribe(result => {
        if (result && Array.isArray(result)) {
          // Direct array response
          this.foreignKeyReferencedTableColumns = result.map(col => col.name || col.id);
        } else if (result && result.result && Array.isArray(result.result)) {
          // Object with result property containing array
          this.foreignKeyReferencedTableColumns = result.result.map(col => col.name || col.id);
        }
      });
    } else {
      this.foreignKeyReferencedTableColumns = [];
      this.foreignKeyReferencedColumn = '';
    }
  }

  // ================================
  // QUERY BUILDER METHODS
  // ================================

  /**
   * Set the query type (SELECT, INSERT, UPDATE, DELETE)
   */
  setQueryType(type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE') {
    this.queryBuilderConfig.queryType = type;
    this.queryBuilderResults = null;
  }

  /**
   * Handle main table selection in query builder
   */
  onQueryBuilderTableSelected() {
    // Load columns for the selected table
    if (this.queryBuilderConfig.mainTable) {
      this.hmiService.askDeviceBrowse(this.selectedDevice.id, this.queryBuilderConfig.mainTable);
      
      if (this.browseSubscription) {
        this.browseSubscription.unsubscribe();
      }
      
      this.browseSubscription = this.hmiService.onDeviceBrowse.subscribe(result => {
        if (result && Array.isArray(result)) {
          this.availableColumns = result.map(col => ({
            name: col.name || col.id,
            type: col.type || 'VARCHAR',
            selected: false
          }));
        } else if (result && result.result && Array.isArray(result.result)) {
          this.availableColumns = result.result.map(col => ({
            name: col.name || col.id,
            type: col.type || 'VARCHAR',
            selected: false
          }));
        }
        this.queryBuilderSelectAll = false;
      });
    }
  }

  /**
   * Toggle select all columns
   */
  toggleSelectAll() {
    this.availableColumns.forEach(col => col.selected = this.queryBuilderSelectAll);
    this.updateSelectedColumns();
  }

  /**
   * Update selected columns array from column checkboxes
   */
  updateSelectedColumns() {
    this.queryBuilderConfig.selectColumns = this.availableColumns
      .filter(col => col.selected)
      .map(col => {
        const selectCol: any = {
          column: col.name,
          alias: undefined
        };
        if (col.aggregate && col.aggregate !== '') {
          selectCol.aggregate = col.aggregate;
        }
        return selectCol;
      });
    this.queryBuilderSelectAll = this.availableColumns.length > 0 && 
                                 this.availableColumns.every(col => col.selected);
  }

  /**
   * Compare function for mat-select
   */
  compareByValue(a: any, b: any): boolean {
    return a === b;
  }

  /**
   * Add a new JOIN
   */
  addJoin() {
    this.queryBuilderConfig.joins.push({
      id: this.queryBuilderService.generateId(),
      type: 'INNER',
      table: '',
      onColumn: '',
      withColumn: ''
    });
  }

  /**
   * Remove a JOIN
   */
  removeJoin(index: number) {
    this.queryBuilderConfig.joins.splice(index, 1);
  }

  /**
   * Add a new WHERE condition
   */
  addCondition() {
    this.queryBuilderConfig.conditions.conditions.push({
      id: this.queryBuilderService.generateId(),
      column: '',
      operator: '=',
      value: '',
      dataType: 'STRING'
    });
  }

  /**
   * Remove a WHERE condition
   */
  removeCondition(index: number) {
    this.queryBuilderConfig.conditions.conditions.splice(index, 1);
  }

  /**
   * Update available operators based on condition column data type
   */
  updateConditionOperators(condition: any) {
    const column = this.availableColumns.find(c => c.name === condition.column);
    if (column) {
      condition.dataType = column.type;
      const operators = this.queryBuilderService.getOperatorsForType(column.type);
      this.queryBuilderConditionOperators = operators;
    }
  }

  /**
   * Get operators for a specific condition
   */
  getConditionOperators(condition: any): string[] {
    if (condition.dataType) {
      return this.queryBuilderService.getOperatorsForType(condition.dataType);
    }
    return this.queryBuilderService.getOperatorsForType('STRING');
  }

  /**
   * Add HAVING condition
   */
  addHavingCondition() {
    this.queryBuilderConfig.havingConditions.conditions.push({
      id: this.queryBuilderService.generateId(),
      column: '',
      operator: '=',
      value: '',
      dataType: 'STRING'
    });
  }

  /**
   * Remove a HAVING condition
   */
  removeHavingCondition(index: number) {
    this.queryBuilderConfig.havingConditions.conditions.splice(index, 1);
  }

  /**
   * Add ORDER BY clause
   */
  addOrderBy() {
    this.queryBuilderConfig.orderByColumns.push({
      column: '',
      direction: 'ASC'
    });
  }

  /**
   * Remove ORDER BY clause
   */
  removeOrderBy(index: number) {
    this.queryBuilderConfig.orderByColumns.splice(index, 1);
  }

  /**
   * Generate the SQL query from builder configuration
   */
  getGeneratedQueryBuilderQuery(): string {
    if (!this.queryBuilderConfig.mainTable) {
      return '-- Select a table first';
    }
    
    // Determine database type from device
    const dbType = this.selectedDevice?.type?.toLowerCase() || 'postgresql';
    return this.queryBuilderService.generateQuery(this.queryBuilderConfig, dbType);
  }

  /**
   * Copy the generated query to clipboard
   */
  copyQueryBuilderQuery() {
    const query = this.getGeneratedQueryBuilderQuery();
    navigator.clipboard.writeText(query).then(() => {
      this.error = 'Query copied to clipboard!';
      setTimeout(() => this.error = '', 3000);
    });
  }

  /**
   * Edit the generated query in SQL Editor tab
   */
  editQueryInSqlEditor() {
    this.customSqlQuery = this.getGeneratedQueryBuilderQuery();
    this.selectedTabIndex = 3; // Switch to SQL Editor tab (index 3)
  }

  /**
   * Execute the generated query
   */
  executeQueryBuilderQuery() {
    if (!this.selectedDevice) {
      this.error = 'No device selected';
      return;
    }

    const query = this.getGeneratedQueryBuilderQuery();
    if (!query || query.startsWith('--')) {
      this.error = 'Please complete the query configuration';
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';
    this.queryBuilderResults = null;

    const querySubscription = this.hmiService.onDeviceOdbcQuery.subscribe(result => {
      this.loading = false;
      
      if (result && result.error) {
        this.error = result.error;
      } else if (result && result.result) {
        const queryResult = result.result;
        this.queryBuilderResults = {
          columns: queryResult.columns || [],
          rows: queryResult.rows || [],
          rowCount: (queryResult.rows || []).length
        };
        this.success = 'Query executed successfully!';
        setTimeout(() => this.success = '', 4000);
      }
      if (querySubscription) {
        querySubscription.unsubscribe();
      }
    });
    this.subscriptions.push(querySubscription);

    // Execute the query
    this.hmiService.executeOdbcQuery(this.selectedDevice.id, query);
  }

  /**
   * Add a new INSERT row
   */
  addInsertRow() {
    this.queryBuilderConfig.insertRows.push({
      id: this.queryBuilderService.generateId(),
      values: {}
    });
  }

  /**
   * Remove an INSERT row
   */
  removeInsertRow(index: number) {
    this.queryBuilderConfig.insertRows.splice(index, 1);
  }

  /**
   * Add an UPDATE value assignment
   */
  addUpdateValue() {
    this.queryBuilderConfig.updateValues.push({
      column: '',
      value: ''
    });
  }

  /**
   * Remove an UPDATE value assignment
   */
  removeUpdateValue(index: number) {
    this.queryBuilderConfig.updateValues.splice(index, 1);
  }

  /**
   * Open/Close help dialog
   */
  toggleHelpDialog() {
    this.showHelpDialog = !this.showHelpDialog;
  }

  /**
   * Copy SQL syntax to clipboard
   */
  copySyntaxToClipboard(syntax: string) {
    navigator.clipboard.writeText(syntax).then(() => {
      this.success = 'Syntax copied to clipboard!';
      setTimeout(() => this.success = '', 3000);
    }).catch(err => {
      this.error = 'Failed to copy to clipboard';
      console.error('Copy failed:', err);
    });
  }

  /**
   * Edit SQL syntax in the SQL Editor
   */
  editSyntaxInSqlEditor(syntax: string) {
    this.customSqlQuery = syntax;
    this.selectedTabIndex = 3; // Switch to SQL Editor tab
    this.showHelpDialog = false;
  }
}
