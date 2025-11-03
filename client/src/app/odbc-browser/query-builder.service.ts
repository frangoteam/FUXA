import { Injectable } from '@angular/core';

export interface QueryBuilderCondition {
    id: string;
    column: string;
    operator: string;
    value: string | number | boolean;
    dataType?: string;
}

export interface QueryBuilderJoin {
    id: string;
    type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'CROSS';
    table: string;
    onColumn: string;
    withColumn: string;
}

export interface QueryBuilderGroup {
    id: string;
    conditions: QueryBuilderCondition[];
    logic: 'AND' | 'OR';
    joinedGroups?: QueryBuilderGroup[];
}

export interface QueryBuilderSelectColumn {
    column: string;
    aggregate?: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT(DISTINCT)';
    alias?: string;
}

export interface QueryBuilderInsertRow {
    id: string;
    values: { [columnName: string]: string | number | boolean };
}

export interface QueryBuilderUpdateValue {
    column: string;
    value: string | number | boolean;
}

export interface QueryBuilderConfig {
    queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
    tables: string[];
    mainTable: string;
    joins: QueryBuilderJoin[];
    selectColumns: QueryBuilderSelectColumn[];
    conditions: QueryBuilderGroup;
    groupByColumns: string[];
    havingConditions: QueryBuilderGroup;
    orderByColumns: { column: string; direction: 'ASC' | 'DESC' | 'ASC NULLS FIRST' | 'DESC NULLS LAST' }[];
    limit?: number;
    offset?: number;
    distinct?: boolean;
    insertRows?: QueryBuilderInsertRow[];
    updateValues?: QueryBuilderUpdateValue[];
}

@Injectable({
    providedIn: 'root'
})
export class QueryBuilderService {

    // Operators for different data types
    private operatorsByType: { [key: string]: string[] } = {
        'STRING': ['=', '!=', 'LIKE', 'NOT LIKE', 'ILIKE', 'SIMILAR TO', 'IN', 'NOT IN', 'IS NULL', 'IS NOT NULL'],
        'NUMBER': ['=', '!=', '>', '<', '>=', '<=', 'BETWEEN', 'IN', 'NOT IN', 'IS NULL', 'IS NOT NULL'],
        'DATE': ['=', '!=', '>', '<', '>=', '<=', 'BETWEEN', 'IS NULL', 'IS NOT NULL'],
        'BOOLEAN': ['=', '!=', 'IS NULL', 'IS NOT NULL']
    };

    // Aggregate functions
    readonly aggregateFunctions = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COUNT(DISTINCT)'];

    // SQL keywords that need to be escaped
    private sqlKeywords = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS', 'ON', 'GROUP', 'BY', 'HAVING', 'ORDER', 'LIMIT', 'OFFSET', 'AS', 'DISTINCT', 'INSERT', 'UPDATE', 'DELETE', 'VALUES', 'SET'];

    constructor() { }

    /**
     * Get available operators for a given data type
     */
    getOperatorsForType(dataType: string): string[] {
        if (!dataType) return this.operatorsByType['STRING'];
        
        const typeUpper = dataType.toUpperCase();
        
        if (typeUpper.includes('INT') || typeUpper.includes('DECIMAL') || typeUpper.includes('NUMERIC') || typeUpper.includes('FLOAT') || typeUpper.includes('REAL') || typeUpper.includes('BIGINT')) {
            return this.operatorsByType['NUMBER'];
        } else if (typeUpper.includes('DATE') || typeUpper.includes('TIME') || typeUpper.includes('TIMESTAMP')) {
            return this.operatorsByType['DATE'];
        } else if (typeUpper.includes('BOOL')) {
            return this.operatorsByType['BOOLEAN'];
        }
        
        return this.operatorsByType['STRING'];
    }

    /**
     * Generate SQL query from builder configuration
     */
    generateQuery(config: QueryBuilderConfig, dbType: string = 'postgresql'): string {
        switch (config.queryType) {
            case 'SELECT':
                return this.generateSelectQuery(config, dbType);
            case 'INSERT':
                return this.generateInsertQuery(config, dbType);
            case 'UPDATE':
                return this.generateUpdateQuery(config, dbType);
            case 'DELETE':
                return this.generateDeleteQuery(config, dbType);
            default:
                return '';
        }
    }

    /**
     * Generate SELECT query
     */
    private generateSelectQuery(config: QueryBuilderConfig, dbType: string): string {
        let query = 'SELECT ';
        
        // DISTINCT
        if (config.distinct) {
            query += 'DISTINCT ';
        }
        
        // Columns with aggregate functions
        if (config.selectColumns.length === 0) {
            query += '* ';
        } else {
            query += config.selectColumns.map(col => {
                let colPart = '';
                
                // Add aggregate function if present
                if (col.aggregate) {
                    if (col.aggregate === 'COUNT(DISTINCT)') {
                        colPart = `COUNT(DISTINCT ${this.escapeIdentifier(col.column, dbType)})`;
                    } else {
                        colPart = `${col.aggregate}(${this.escapeIdentifier(col.column, dbType)})`;
                    }
                } else {
                    colPart = this.escapeIdentifier(col.column, dbType);
                }
                
                // Add alias if present
                if (col.alias) {
                    colPart += ` AS ${this.escapeIdentifier(col.alias, dbType)}`;
                }
                
                return colPart;
            }).join(', ') + ' ';
        }
        
        // FROM
        query += `FROM ${this.escapeIdentifier(config.mainTable, dbType)} `;
        
        // JOINS
        if (config.joins && config.joins.length > 0) {
            config.joins.forEach(join => {
                query += `${join.type} JOIN ${this.escapeIdentifier(join.table, dbType)} ON ${this.escapeIdentifier(join.onColumn, dbType)} = ${this.escapeIdentifier(join.withColumn, dbType)} `;
            });
        }
        
        // WHERE
        if (config.conditions && this.hasConditions(config.conditions)) {
            query += `WHERE ${this.buildConditionsString(config.conditions, dbType)} `;
        }
        
        // GROUP BY
        if (config.groupByColumns && config.groupByColumns.length > 0) {
            query += `GROUP BY ${config.groupByColumns.map(col => this.escapeIdentifier(col, dbType)).join(', ')} `;
        }
        
        // HAVING
        if (config.havingConditions && this.hasConditions(config.havingConditions)) {
            query += `HAVING ${this.buildConditionsString(config.havingConditions, dbType)} `;
        }
        
        // ORDER BY
        if (config.orderByColumns && config.orderByColumns.length > 0) {
            query += `ORDER BY ${config.orderByColumns.map(o => `${this.escapeIdentifier(o.column, dbType)} ${o.direction}`).join(', ')} `;
        }
        
        // LIMIT
        if (config.limit) {
            query += `LIMIT ${config.limit} `;
        }
        
        // OFFSET
        if (config.offset) {
            query += `OFFSET ${config.offset} `;
        }
        
        return query.trim() + ';';
    }

    /**
     * Generate INSERT query
     */
    private generateInsertQuery(config: QueryBuilderConfig, dbType: string): string {
        if (!config.insertRows || config.insertRows.length === 0) {
            return '';
        }
        
        // Get all unique columns from all rows
        const allColumns = new Set<string>();
        config.insertRows.forEach(row => {
            Object.keys(row.values).forEach(col => allColumns.add(col));
        });
        
        if (allColumns.size === 0) {
            return '';
        }
        
        const columnNames = Array.from(allColumns);
        const columnList = columnNames.map(col => this.escapeIdentifier(col, dbType)).join(', ');
        
        // Generate values for each row
        const valueSets = config.insertRows.map(row => {
            const rowValues = columnNames.map(col => {
                const value = row.values[col];
                return this.formatValue(value, dbType);
            });
            return `(${rowValues.join(', ')})`;
        });
        
        return `INSERT INTO ${this.escapeIdentifier(config.mainTable, dbType)} (${columnList}) VALUES ${valueSets.join(', ')};`;
    }

    /**
     * Generate UPDATE query
     */
    private generateUpdateQuery(config: QueryBuilderConfig, dbType: string): string {
        if (!config.updateValues || config.updateValues.length === 0) {
            return '';
        }
        
        let query = `UPDATE ${this.escapeIdentifier(config.mainTable, dbType)} SET `;
        query += config.updateValues.map(v => `${this.escapeIdentifier(v.column, dbType)} = ${this.formatValue(v.value, dbType)}`).join(', ') + ' ';
        
        if (config.conditions && this.hasConditions(config.conditions)) {
            query += `WHERE ${this.buildConditionsString(config.conditions, dbType)} `;
        }
        
        return query.trim() + ';';
    }

    /**
     * Generate DELETE query
     */
    private generateDeleteQuery(config: QueryBuilderConfig, dbType: string): string {
        let query = `DELETE FROM ${this.escapeIdentifier(config.mainTable, dbType)} `;
        
        if (config.conditions && this.hasConditions(config.conditions)) {
            query += `WHERE ${this.buildConditionsString(config.conditions, dbType)} `;
        }
        
        return query.trim() + ';';
    }

    /**
     * Build WHERE conditions string
     */
    private buildConditionsString(group: QueryBuilderGroup, dbType: string): string {
        if (!group || !group.conditions || group.conditions.length === 0) {
            return '';
        }
        
        let conditionStrings: string[] = [];
        
        // Process conditions in this group
        group.conditions.forEach(condition => {
            const conditionStr = this.buildConditionString(condition, dbType);
            if (conditionStr) {
                conditionStrings.push(conditionStr);
            }
        });
        
        // Process nested groups
        if (group.joinedGroups && group.joinedGroups.length > 0) {
            group.joinedGroups.forEach(nestedGroup => {
                const nestedStr = this.buildConditionsString(nestedGroup, dbType);
                if (nestedStr) {
                    conditionStrings.push(`(${nestedStr})`);
                }
            });
        }
        
        if (conditionStrings.length === 0) {
            return '';
        }
        
        const logic = group.logic || 'AND';
        return conditionStrings.join(` ${logic} `);
    }

    /**
     * Build single condition string
     */
    private buildConditionString(condition: QueryBuilderCondition, dbType: string): string {
        const column = this.escapeIdentifier(condition.column, dbType);
        const operator = condition.operator.toUpperCase();
        
        if (operator === 'IS NULL' || operator === 'IS NOT NULL') {
            return `${column} ${operator}`;
        }
        
        if (operator === 'IN' || operator === 'NOT IN') {
            return `${column} ${operator} (${condition.value})`;
        }
        
        const value = this.formatValue(condition.value, dbType);
        return `${column} ${operator} ${value}`;
    }

    /**
     * Check if group has any conditions
     */
    private hasConditions(group: QueryBuilderGroup): boolean {
        if (!group) return false;
        if (group.conditions && group.conditions.length > 0) return true;
        if (group.joinedGroups && group.joinedGroups.some(g => this.hasConditions(g))) return true;
        return false;
    }

    /**
     * Escape identifier (table/column names)
     */
    private escapeIdentifier(identifier: string, dbType: string): string {
        if (!identifier) return identifier;
        
        // If identifier contains dots (table.column), escape each part
        if (identifier.includes('.')) {
            return identifier.split('.').map(part => this.escapeIdentifier(part, dbType)).join('.');
        }
        
        // If it's a SQL keyword, quote it
        if (this.sqlKeywords.includes(identifier.toUpperCase())) {
            return this.getQuoteChar(dbType) + identifier + this.getQuoteChar(dbType);
        }
        
        // If it contains special characters, quote it
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
            return this.getQuoteChar(dbType) + identifier + this.getQuoteChar(dbType);
        }
        
        return identifier;
    }

    /**
     * Format value based on type
     */
    private formatValue(value: any, dbType: string): string {
        if (value === null || value === undefined) {
            return 'NULL';
        }
        
        if (typeof value === 'boolean') {
            if (dbType === 'postgresql' || dbType === 'mysql' || dbType === 'mariadb') {
                return value ? 'true' : 'false';
            } else if (dbType === 'mssql' || dbType === 'freetds') {
                return value ? '1' : '0';
            } else {
                return value ? '1' : '0';
            }
        }
        
        if (typeof value === 'number') {
            return value.toString();
        }
        
        if (typeof value === 'string') {
            // Escape single quotes
            const escaped = value.replace(/'/g, "''");
            return `'${escaped}'`;
        }
        
        return value.toString();
    }

    /**
     * Get quote character for database type
     */
    private getQuoteChar(dbType: string): string {
        if (dbType === 'mssql' || dbType === 'freetds') {
            return '"';
        }
        return '"'; // PostgreSQL, MySQL use backticks for MySQL or quotes for PostgreSQL
    }

    /**
     * Parse query (for loading/editing existing queries)
     */
    parseQuery(query: string, dbType: string): Partial<QueryBuilderConfig> {
        // This is a simplified parser - for full support, would need proper SQL parser
        const config: Partial<QueryBuilderConfig> = {
            queryType: 'SELECT',
            tables: [],
            selectColumns: [],
            conditions: { id: 'root', conditions: [], logic: 'AND' }
        };
        
        // Basic parsing to extract main table and columns
        const selectMatch = query.match(/SELECT\s+(.+?)\s+FROM\s+(\w+)/i);
        if (selectMatch) {
            // Parse columns - convert strings to QueryBuilderSelectColumn objects
            config.selectColumns = selectMatch[1].split(',').map(c => {
                const col = c.trim();
                return {
                    column: col,
                    aggregate: undefined,
                    alias: undefined
                };
            });
            config.mainTable = selectMatch[2];
        }
        
        return config;
    }

    /**
     * Create new empty configuration
     */
    createEmptyConfig(): QueryBuilderConfig {
        return {
            queryType: 'SELECT',
            tables: [],
            mainTable: '',
            joins: [],
            selectColumns: [],
            conditions: {
                id: this.generateId(),
                conditions: [],
                logic: 'AND'
            },
            havingConditions: {
                id: this.generateId(),
                conditions: [],
                logic: 'AND'
            },
            groupByColumns: [],
            orderByColumns: [],
            insertRows: [],
            updateValues: [],
            distinct: false,
            limit: undefined,
            offset: undefined
        };
    }

    /**
     * Generate unique ID
     */
    generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
