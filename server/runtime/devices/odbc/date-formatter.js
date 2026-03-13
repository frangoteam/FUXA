/**
 * Date/Time Formatter for ODBC Queries
 * 
 * Handles conversion and formatting of date/time values in SQL queries
 * to ensure consistent, database-agnostic formatting across all ODBC operations.
 * 
 * Supports:
 * - DATE: YYYY-MM-DD
 * - TIME: HH:mm:ss
 * - TIMESTAMP: YYYY-MM-DD HH:mm:ss.fff
 * - DATETIME: YYYY-MM-DD HH:mm:ss.fff
 * - SMALLDATETIME: YYYY-MM-DD HH:mm:ss
 */

'use strict';

/**
 * Converts any value to a properly formatted string
 * Handles Date objects from Material datepickers at a single point of truth
 * @param {any} value - Any value (Date object, string, number, etc.)
 * @returns {string} - String representation of the value
 */
function formatAnyValue(value) {
    if (value === null || value === undefined) {
        return '';
    }
    
    // Handle Date objects from Material datepickers
    if (value instanceof Date) {
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const day = String(value.getDate()).padStart(2, '0');
        const hours = String(value.getHours()).padStart(2, '0');
        const minutes = String(value.getMinutes()).padStart(2, '0');
        const seconds = String(value.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
    
    return String(value);
}

/**
 * Detects the SQL data type category
 * @param {string} columnType - The column type string from database metadata
 * @returns {string} - One of: 'DATE', 'TIME', 'TIMESTAMP', 'DATETIME', 'SMALLDATETIME', or 'UNKNOWN'
 */
function detectSqlType(columnType) {
    if (!columnType) return 'UNKNOWN';
    
    const typeUpper = String(columnType).toUpperCase();
    
    // DATE types
    if (typeUpper.includes('DATE') && !typeUpper.includes('TIME')) {
        return 'DATE';
    }
    
    // TIME types (but not TIMESTAMP/DATETIME)
    if (typeUpper.includes('TIME') && !typeUpper.includes('STAMP') && !typeUpper.includes('DATETIME')) {
        return 'TIME';
    }
    
    // SMALLDATETIME - check before DATETIME since it contains 'DATETIME'
    if (typeUpper.includes('SMALLDATETIME')) {
        return 'SMALLDATETIME';
    }
    
    // DATETIME types
    if (typeUpper.includes('DATETIME')) {
        return 'DATETIME';
    }
    
    // TIMESTAMP types
    if (typeUpper.includes('TIMESTAMP')) {
        return 'TIMESTAMP';
    }
    
    return 'UNKNOWN';
}

/**
 * Parses various date string formats
 * Supports multiple formats:
 * - ISO: 2025-01-15, 2025-01-15T14:30:45
 * - US: 01/15/2025, 01-15-2025
 * - EU: 15/01/2025, 15-01-2025
 * - ISO Time: 2025-01-15 14:30:45, 2025-01-15 14:30:45.123
 * - With Time: 01/15/2025 14:30:45, 15/01/2025 14:30:45
 * 
 * @param {any} dateString - Date string, Date object, or timestamp
 * @returns {Date} - Parsed Date object
 */
function parseDate(dateString) {
    if (dateString instanceof Date) {
        return dateString;
    }
    
    if (typeof dateString !== 'string') {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            throw new Error(`Invalid date format: ${dateString}`);
        }
        return date;
    }
    
    const str = dateString.trim();
    
    // Replace T separator with space for parsing (HTML5 datetime-local format sends "2025-01-15T14:30:45")
    const normalizedStr = str.replace('T', ' ');
    
    // Remove timezone info if present
    const cleanStr = normalizedStr.replace(/Z|[+-]\d{2}:\d{2}$/, '').trim();
    
    // Try ISO parse first (2025-01-15 or 2025-01-15T14:30:45 or 2025-01-15 14:30:45)
    if (/^\d{4}-\d{2}-\d{2}/.test(cleanStr)) {
        const date = new Date(cleanStr);
        if (!isNaN(date.getTime())) {
            return date;
        }
    }
    
    // Try DD/MM/YYYY or DD-MM-YYYY (with optional time)
    // Pattern: 15/01/2025 or 15-01-2025 or 15/01/2025 14:30:45
    let match = cleanStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{3}))?)?)?/);
    if (match) {
        const [, day, month, year, hours, minutes, seconds, millis] = match;
        const d = new Date(year, parseInt(month) - 1, day, hours || 0, minutes || 0, seconds || 0, millis || 0);
        if (!isNaN(d.getTime())) {
            return d;
        }
    }
    
    // Try MM/DD/YYYY or MM-DD-YYYY (US format - with optional time)
    // Only try this if we haven't already matched - assume first number > 12 is day (EU format)
    match = cleanStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{3}))?)?)?/);
    if (match) {
        const [, first, second, year, hours, minutes, seconds, millis] = match;
        const firstNum = parseInt(first);
        const secondNum = parseInt(second);
        
        // If first number > 12, it's likely day/month (EU format): day/month/year
        if (firstNum > 12) {
            const d = new Date(year, secondNum - 1, firstNum, hours || 0, minutes || 0, seconds || 0, millis || 0);
            if (!isNaN(d.getTime())) {
                return d;
            }
        }
        // Otherwise assume month/day/year (US format)
        else {
            const d = new Date(year, firstNum - 1, secondNum, hours || 0, minutes || 0, seconds || 0, millis || 0);
            if (!isNaN(d.getTime())) {
                return d;
            }
        }
    }
    
    // Try YYYY/MM/DD (alternative ISO format with slashes)
    match = cleanStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{3}))?)?)?/);
    if (match) {
        const [, year, month, day, hours, minutes, seconds, millis] = match;
        const d = new Date(year, parseInt(month) - 1, day, hours || 0, minutes || 0, seconds || 0, millis || 0);
        if (!isNaN(d.getTime())) {
            return d;
        }
    }
    
    // Try default Date parsing as fallback
    const date = new Date(cleanStr);
    if (!isNaN(date.getTime())) {
        return date;
    }
    
    throw new Error(`Could not parse date: ${dateString}. Supported formats: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, YYYY/MM/DD, with optional HH:mm:ss or HH:mm:ss.fff`);
}

/**
 * Pads a number to 2 digits
 * @param {number} num - Number to pad
 * @returns {string} - Zero-padded string
 */
function pad(num) {
    return String(num).padStart(2, '0');
}

/**
 * Formats a date to YYYY-MM-DD format
 * @param {Date} date - Date object
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    return `${year}-${month}-${day}`;
}

/**
 * Formats a time to HH:mm:ss format
 * @param {Date} date - Date object
 * @returns {string} - Formatted time string
 */
function formatTime(date) {
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${hours}:${minutes}:${seconds}`;
}

/**
 * Formats a timestamp to YYYY-MM-DD HH:mm:ss.fff format
 * @param {Date} date - Date object
 * @returns {string} - Formatted timestamp string
 */
function formatTimestamp(date) {
    const dateStr = formatDate(date);
    const timeStr = formatTime(date);
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    return `${dateStr} ${timeStr}.${milliseconds}`;
}

/**
 * Formats a datetime to YYYY-MM-DD HH:mm:ss.fff format
 * @param {Date} date - Date object
 * @returns {string} - Formatted datetime string
 */
function formatDatetime(date) {
    return formatTimestamp(date);
}

/**
 * Formats a small datetime to YYYY-MM-DD HH:mm:ss format
 * @param {Date} date - Date object
 * @returns {string} - Formatted small datetime string
 */
function formatSmallDatetime(date) {
    const dateStr = formatDate(date);
    const timeStr = formatTime(date);
    return `${dateStr} ${timeStr}`;
}

/**
 * Escapes a string to prevent SQL injection
 * Doubles single quotes
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
function escapeString(str) {
    if (typeof str !== 'string') {
        return str;
    }
    return str.replace(/'/g, "''");
}

/**
 * Formats a value for SQL based on its type
 * Returns properly quoted SQL value
 * @param {any} value - Value to format
 * @param {string} columnType - SQL column type
 * @returns {string} - SQL-formatted value (with quotes)
 */
function formatValue(value, columnType) {
    // Handle NULL
    if (value === null || value === undefined || value === '') {
        return 'NULL';
    }
    
    const sqlType = detectSqlType(columnType);
    
    try {
        switch (sqlType) {
            case 'DATE': {
                const date = parseDate(value);
                const formatted = formatDate(date);
                return `'${formatted}'`;
            }
            case 'TIME': {
                const date = parseDate(value);
                const formatted = formatTime(date);
                return `'${formatted}'`;
            }
            case 'TIMESTAMP': {
                const date = parseDate(value);
                const formatted = formatTimestamp(date);
                return `'${formatted}'`;
            }
            case 'DATETIME': {
                const date = parseDate(value);
                const formatted = formatDatetime(date);
                return `'${formatted}'`;
            }
            case 'SMALLDATETIME': {
                const date = parseDate(value);
                const formatted = formatSmallDatetime(date);
                return `'${formatted}'`;
            }
            default:
                // Not a date/time type, return as escaped string
                const escaped = escapeString(String(value));
                return `'${escaped}'`;
        }
    } catch (err) {
        // If parsing fails, return as escaped string
        const escaped = escapeString(String(value));
        return `'${escaped}'`;
    }
}

/**
 * Validates a value format for a given SQL type
 * @param {any} value - Value to validate
 * @param {string} columnType - SQL column type
 * @returns {boolean} - True if format is valid
 */
function validateFormat(value, columnType) {
    if (value === null || value === undefined || value === '') {
        return true; // NULL is always valid
    }
    
    const sqlType = detectSqlType(columnType);
    
    // Regex patterns for validation
    const patterns = {
        'DATE': /^\d{4}-\d{2}-\d{2}$/,
        'TIME': /^\d{2}:\d{2}:\d{2}$/,
        'TIMESTAMP': /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/,
        'DATETIME': /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/,
        'SMALLDATETIME': /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
    };
    
    const pattern = patterns[sqlType];
    if (!pattern) {
        return true; // Unknown type, assume valid
    }
    
    return pattern.test(String(value));
}

/**
 * Gets format information for a given SQL type
 * Useful for generating format hints in UI
 * @param {string} columnType - SQL column type
 * @returns {object} - Format information {format, regex, example}
 */
function getFormatInfo(columnType) {
    const sqlType = detectSqlType(columnType);
    
    const info = {
        'DATE': {
            format: 'YYYY-MM-DD',
            regex: /^\d{4}-\d{2}-\d{2}$/,
            example: new Date().toISOString().split('T')[0]
        },
        'TIME': {
            format: 'HH:mm:ss',
            regex: /^\d{2}:\d{2}:\d{2}$/,
            example: `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}:${pad(new Date().getSeconds())}`
        },
        'TIMESTAMP': {
            format: 'YYYY-MM-DD HH:mm:ss.fff',
            regex: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/,
            example: new Date().toISOString()
        },
        'DATETIME': {
            format: 'YYYY-MM-DD HH:mm:ss.fff',
            regex: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/,
            example: new Date().toISOString()
        },
        'SMALLDATETIME': {
            format: 'YYYY-MM-DD HH:mm:ss',
            regex: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
            example: formatSmallDatetime(new Date())
        }
    };
    
    return info[sqlType] || { format: 'Unknown', regex: null, example: null };
}

/**
 * Detects the format type of a value
 * - DATE: YYYY-MM-DD (10 chars)
 * - TIME: HH:mm:ss (8 chars)
 * - DATETIME: YYYY-MM-DD HH:mm:ss or YYYY-MM-DDTHH:mm:ss (19+ chars)
 * 
 * @param {any} value - The value to analyze (Date object or string)
 * @returns {string} - 'DATE', 'TIME', 'DATETIME', or 'UNKNOWN'
 */
function detectValueFormat(value) {
    // Convert Date objects to string first
    const stringValue = formatAnyValue(value);
    
    if (!stringValue || typeof stringValue !== 'string') {
        return 'UNKNOWN';
    }
    
    const val = stringValue.trim();
    
    // Check if contains both date and time
    if (val.includes(' ') || val.includes('T')) {
        // Contains space or T, so it's DATETIME/TIMESTAMP
        if (/^\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}/.test(val)) {
            return 'DATETIME';
        }
    }
    
    // Check if it's just a date (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        return 'DATE';
    }
    
    // Check if it's just a time (HH:mm:ss)
    if (/^\d{2}:\d{2}:\d{2}$/.test(val)) {
        return 'TIME';
    }
    
    return 'UNKNOWN';
}

/**
 * Formats a value based on its detected format
 * - DATE values stay as YYYY-MM-DD
 * - TIME values stay as HH:mm:ss
 * - DATETIME values become YYYY-MM-DD HH:mm:ss
 * 
 * @param {any} value - The raw value from user input (Date object or string)
 * @returns {string} - Formatted and quoted SQL value
 */
function formatValueByDetection(value) {
    // Convert Date objects to string first
    const stringValue = formatAnyValue(value);
    
    if (!stringValue || stringValue === '') {
        return 'NULL';
    }
    
    if (stringValue.toUpperCase() === 'NULL') {
        return 'NULL';
    }
    
    const format = detectValueFormat(stringValue);
    
    try {
        switch (format) {
            case 'DATE':
                // Parse and reformat to ensure consistency
                const dateObj = parseDate(stringValue);
                const formatted = formatDate(dateObj);
                return `'${formatted}'`;
            
            case 'TIME':
                // Parse and reformat to ensure consistency
                const timeObj = parseDate(stringValue);
                const timeStr = formatTime(timeObj);
                return `'${timeStr}'`;
            
            case 'DATETIME':
                // Parse and reformat to ensure consistency
                const dtObj = parseDate(stringValue);
                const dtStr = formatDatetime(dtObj);
                return `'${dtStr}'`;
            
            default:
                // Not a recognized date/time format, treat as string
                const escaped = escapeString(String(stringValue));
                return `'${escaped}'`;
        }
    } catch (err) {
        // If parsing fails, return as escaped string
        const escaped = escapeString(String(stringValue));
        return `'${escaped}'`;
    }
}

/**
 * Processes a SQL query and converts any date/time values
 * Auto-detects value format from the actual value:
 * - YYYY-MM-DD → DATE format
 * - HH:mm:ss → TIME format
 * - YYYY-MM-DD HH:mm:ss or YYYY-MM-DDTHH:mm:ss → DATETIME format
 * 
 * Handles all SQL operations:
 * - WHERE clauses: WHERE dateColumn = '2025-01-15'
 * - INSERT statements: INSERT INTO table (col1, date_col) VALUES (val1, '2025-01-15')
 * - UPDATE statements: UPDATE table SET date_col = '2025-01-15' WHERE id = 1
 * - BETWEEN conditions: WHERE date_col BETWEEN '2025-01-01' AND '2025-12-31'
 * - Comparison operators: <, >, <=, >=, <>
 * 
 * @param {string} query - SQL query string
 * @param {object} columnTypes - DEPRECATED - kept for compatibility, values are auto-detected now
 * @returns {string} - Normalized query with formatted date/time values
 */
function normalizeQuery(query, columnTypes) {
    if (!query) {
        return query;
    }
    
    let normalizedQuery = query;
    
    // FIRST: Handle unquoted JavaScript Date toString() format strings
    // Pattern: "Sat Nov 01 2025 00:00:00 GMT+1300 (New Zealand Daylight Time)"
    // These come from Material datepickers and need to be converted to quoted ISO format
    // Regex explanation:
    // - \b: word boundary (start of token)
    // - [A-Z][a-z]{2}\s+: Day name (Sat, Mon, etc.)
    // - [A-Z][a-z]{2}\s+: Month name (Jan, Nov, etc.)
    // - \d{1,2}\s+: Day number
    // - \d{4}\s+: Year
    // - \d{1,2}:\d{2}:\d{2}\s+: Time (HH:mm:ss)
    // - GMT[+-]\d{4}: Timezone offset (GMT+1300)
    // - \s*\([^)]*\)?: Optional timezone name in parentheses like (New Zealand Daylight Time)
    normalizedQuery = normalizedQuery.replace(
        /[A-Z][a-z]{2}\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+GMT[+-]\d{4}(?:\s*\([^)]*\))?/g,
        (match) => {
            try {
                // Parse the JavaScript Date toString format
                const date = new Date(match);
                if (!isNaN(date.getTime())) {
                    // Successfully parsed, format as ISO datetime and quote it
                    const formatted = formatDatetime(date);
                    return `'${formatted}'`;
                }
            } catch (err) {
                // If parsing fails, leave original
            }
            return match;
        }
    );
    
    // SECOND: Find all quoted values in the query and try to detect/format them as date/time
    // Pattern: 'value'
    normalizedQuery = normalizedQuery.replace(/'([^']*)'/g, (match, quotedVal) => {
        try {
            const format = detectValueFormat(quotedVal);
            if (format !== 'UNKNOWN') {
                // This looks like a date/time value, format it
                return formatValueByDetection(quotedVal);
            }
        } catch (err) {
            // If detection/formatting fails, return original
        }
        return match;
    });
    
    return normalizedQuery;
}

// Export functions
module.exports = {
    formatAnyValue,
    detectSqlType,
    parseDate,
    formatDate,
    formatTime,
    formatTimestamp,
    formatDatetime,
    formatSmallDatetime,
    escapeString,
    formatValue,
    validateFormat,
    getFormatInfo,
    detectValueFormat,
    formatValueByDetection,
    normalizeQuery
};
