import { HttpClient, HttpHeaders, HttpXhrBackend } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { EndPointApi } from '../_helpers/endpointapi';

export class RepeaterData {
    id: string;
    name: string;
    lines: RepeaterDataLine[];
}

export class RepeaterDataLine {
    id: string;
    name: string;
    /** RepeaterSourceType: 'url' (default, also legacy lines) or 'db' */
    type?: string;
    /** DB: id of the DAQ storage (device id for SQLite, @app for the FUXA App DB) */
    daq?: string;
    /** DB: read-only SQL query, every row is an item */
    sql?: string;
    url: string;
    /** RepeaterDataType: 'json' (default, also any legacy value) or 'csv' */
    url_data_type: string;
    url_data_properties: string;
    /** optional dotted path to the items inside the JSON (e.g. 'data' or 'result.items') */
    url_data_path?: string;
}

export enum RepeaterSourceType {
    url = 'url',
    db = 'db',
}

export interface RepeaterDaqNode {
    id: string;
    name: string;
    type: string;
}

export enum RepeaterDataType {
    json = 'json',
    csv = 'csv',
}

export class RepeaterUtils {

    static isCsv(line: RepeaterDataLine): boolean {
        return !RepeaterUtils.isDb(line) && (line?.url_data_type || '').toLowerCase() === RepeaterDataType.csv;
    }

    static isDb(line: RepeaterDataLine): boolean {
        return line?.type === RepeaterSourceType.db;
    }

    /** headers for the FUXA server API (the static HttpClient has no auth interceptor) */
    static getAuthHeaders(): HttpHeaders {
        let headers = new HttpHeaders({ 'Accept': 'application/json' });
        try {
            const user = JSON.parse(sessionStorage.getItem('currentUser'));
            if (user?.token) {
                headers = headers.set('x-access-token', user.token);
            }
        } catch (err) { }
        return headers;
    }

    /**
     * Absolute http(s) URLs are used as they are (GitHub file pages are mapped to the raw file),
     * relative paths are resolved against the FUXA server (e.g. a path configured in settings.proxies).
     */
    static resolveUrl(url: string): string {
        const value = (url || '').trim();
        const github = value.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/i);
        if (github) {
            return `https://raw.githubusercontent.com/${github[1]}/${github[2]}/${github[3]}`;
        }
        if (/^https?:\/\//i.test(value)) {
            return value;
        }
        return EndPointApi.getURL() + (value.startsWith('/') ? value : '/' + value);
    }

    /** return the items (array or object) found at the dotted path, the whole JSON without path */
    static selectItems(json: any, path?: string): any {
        const keys = (path || '').split('.').map(k => k.trim()).filter(k => k);
        const items = keys.reduce((obj, key) => (obj === null || obj === undefined) ? undefined : obj[key], json);
        return items ?? {};
    }

    /**
     * Parse CSV text (RFC 4180 quoting) into objects keyed by the header row.
     * The delimiter (comma, semicolon or tab) is detected from the header line.
     */
    static parseCsv(text: string): any[] {
        const source = (text || '').replace(/^\uFEFF/, '');
        const headerLine = source.split(/\r?\n/, 1)[0];
        const count = (d: string) => headerLine.split(d).length;
        const delimiter = [';', '\t'].reduce((best, d) => count(d) > count(best) ? d : best, ',');
        const rows: string[][] = [];
        let row: string[] = [];
        let field = '';
        let quoted = false;
        for (let i = 0; i < source.length; i++) {
            const c = source[i];
            if (quoted) {
                if (c === '"' && source[i + 1] === '"') {
                    field += '"';
                    i++;
                } else if (c === '"') {
                    quoted = false;
                } else {
                    field += c;
                }
            } else if (c === '"') {
                quoted = true;
            } else if (c === delimiter) {
                row.push(field);
                field = '';
            } else if (c === '\n' || c === '\r') {
                if (c === '\r' && source[i + 1] === '\n') {
                    i++;
                }
                row.push(field);
                rows.push(row);
                row = [];
                field = '';
            } else {
                field += c;
            }
        }
        if (field !== '' || row.length) {
            row.push(field);
            rows.push(row);
        }
        const lines = rows.filter(r => r.some(v => v.trim() !== ''));
        if (!lines.length) {
            return [];
        }
        const header = lines[0].map(h => h.trim());
        return lines.slice(1).map(r => header.reduce((item, key, index) => {
            item[key] = (r[index] ?? '').trim();
            return item;
        }, {}));
    }

    /** a JSON text (object or array) decoded, other values as they are */
    static decodeJson(value: any): any {
        if (typeof value === 'string' && /^\s*[\[{]/.test(value)) {
            try {
                return JSON.parse(value);
            } catch (err) { }
        }
        return value;
    }

    /**
     * value of a field, also nested with a dotted path: 'tags.Temperature.value'.
     * JSON text values on the path are decoded, keys can contain dots (the longest key is tried first)
     */
    static getField(item: any, field: string): any {
        item = RepeaterUtils.decodeJson(item);
        if (item === null || typeof item !== 'object' || !field) {
            return undefined;
        }
        if (item[field] !== undefined) {
            return item[field];
        }
        for (let i = field.lastIndexOf('.'); i > 0; i = field.lastIndexOf('.', i - 1)) {
            const head = field.substring(0, i);
            if (item[head] !== undefined) {
                return RepeaterUtils.getField(item[head], field.substring(i + 1));
            }
        }
        return undefined;
    }

    /** a tag entry: object with the tag id and value (e.g. the entries of the App DB devices.tagList) */
    static isTagEntry(value: any): boolean {
        return value !== null && typeof value === 'object' && !Array.isArray(value) && typeof value.id === 'string' && 'value' in value;
    }

    /**
     * id of the tag at the field: the field is a tag entry ('tags.Temperature') or its value ('tags.Temperature.value'),
     * null for other fields
     */
    static getFieldTagId(item: any, field: string): string {
        const value = RepeaterUtils.decodeJson(RepeaterUtils.getField(item, field));
        if (RepeaterUtils.isTagEntry(value)) {
            return value.id;
        }
        if (field?.endsWith('.value')) {
            const parent = RepeaterUtils.decodeJson(RepeaterUtils.getField(item, field.substring(0, field.length - '.value'.length)));
            if (RepeaterUtils.isTagEntry(parent)) {
                return parent.id;
            }
        }
        return null;
    }

    /**
     * tag id for a placeholder path of the values passed to a view (e.g. by a Repeater item click):
     * '@tags.Temperature' with { '@tags': '{"Temperature":{"id":"t1","value":..}}' } -> 't1'
     */
    static getPlaceholderTagId(placeholderValues: { [placeholder: string]: any }, variableId: string): string {
        if (!placeholderValues || typeof variableId !== 'string' || !variableId.startsWith('@') || variableId.indexOf('.') < 0) {
            return null;
        }
        const values = {};
        Object.keys(placeholderValues).forEach(key => values[key.startsWith('@') ? key.substring(1) : key] = placeholderValues[key]);
        return RepeaterUtils.getFieldTagId(values, variableId.substring(1));
    }

    /** the DAQ storages that can run SQL queries */
    static getDaqNodes(): Observable<RepeaterDaqNode[]> {
        const http = new HttpClient(new HttpXhrBackend({ build: () => new XMLHttpRequest() }));
        return http.get<RepeaterDaqNode[]>(EndPointApi.getURL() + '/api/daq/sql/nodes',
            { headers: RepeaterUtils.getAuthHeaders(), withCredentials: true });
    }

    /**
     * load the data of a Repeater data line (URL with JSON or CSV, or DB with the rows of the SQL query)
     * and return the items to repeat. The SQL of a DB line runs on the server from the saved project
     */
    static getItems(line: RepeaterDataLine, repeaterId?: string): Observable<any> {
        if (RepeaterUtils.isDb(line)) {
            const http = new HttpClient(new HttpXhrBackend({ build: () => new XMLHttpRequest() }));
            const params: any = { repeater: repeaterId || '' };
            if (line.id) {
                params.line = line.id;
            }
            return http.get<any[]>(EndPointApi.getURL() + '/api/daq/sql/repeater',
                { headers: RepeaterUtils.getAuthHeaders(), params, withCredentials: true }).pipe(map(rows => rows || []));
        }
        const url = RepeaterUtils.resolveUrl(line?.url);
        if (RepeaterUtils.isCsv(line)) {
            const http = new HttpClient(new HttpXhrBackend({ build: () => new XMLHttpRequest() }));
            return http.get(url, { responseType: 'text' }).pipe(map(text => RepeaterUtils.parseCsv(text)));
        }
        return EndPointApi.getJSONFromURL(url).pipe(
            map(result => RepeaterUtils.selectItems(result, line?.url_data_path))
        );
    }
}
