import { Injectable, Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

declare const numeral: any;

@Injectable()
export class Utils {

    static _seed = Date.now();

    static defaultColor = ['#FFFFFF', '#000000', '#EEECE1', '#1F497D', '#4F81BD', '#C0504D', '#9BBB59', '#8064A2', '#4BACC6',
        '#F79646', '#C00000', '#FF0000', '#FFC000', '#FFD04A', '#FFFF00', '#92D050', '#0AC97D', '#00B050', '#00B0F0', '#4484EF', '#3358C0',
        '#002060', '#7030A0', '#D8D8D8', '#BFBFBF', '#A5A5A5', '#7F7F7F', '#595959', '#3F3F3F', '#262626'];

    static lineColor = ['#4484ef', '#ef0909', '#00b050', '#ffd04a', '#7030a0', '#a5a5a5', '#c0504d', '#000000'];

    static searchTreeStartWith(element, matchingStart) {
        if (element.id.startsWith(matchingStart)) {
            return element;
        } else if (element.children != null) {
            var i;
            var result = null;
            for (i = 0; result == null && i < element.children.length; i++) {
                result = Utils.searchTreeStartWith(element.children[i], matchingStart);
            }
            return result;
        }
        return null;
    }

    static findElementByIdRecursive(root: HTMLElement, id: string): HTMLElement | null {
        if (!root) {
          return null;
        }
        if (root.id === id) {
          return root;
        }
        for (let i = 0; i < root.children.length; i++) {
          const child = root.children[i] as HTMLElement;
          const foundElement = this.findElementByIdRecursive(child, id);
          if (foundElement) {
            return foundElement;
          }
        }
        return null;
    }

    static searchValuesByAttribute(jsonData: any, attributeName: string) {
        const result: string[] = [];
        function search(jsonData: any): void {
            if (Array.isArray(jsonData)) {
                for (const item of jsonData) {
                  search(item);
                }
            } else if (typeof jsonData === 'object' && jsonData !== null) {
                if (jsonData.hasOwnProperty(attributeName)) {
                    result.push(jsonData[attributeName]);
                }
                for (const key in jsonData) {
                  search(jsonData[key]);
                }
              }
        }
        search(jsonData);
        return result;
    }

    static changeAttributeValue(jsonData: any, attributeName: string, srcValue: any, destValue: any) {
        function change(jsonData: any): void {
            if (Array.isArray(jsonData)) {
                for (const item of jsonData) {
                    change(item);
                }
            } else if (typeof jsonData === 'object' && jsonData !== null) {
                if (jsonData.hasOwnProperty(attributeName) && jsonData[attributeName] === srcValue) {
                    jsonData[attributeName] = destValue;
                }
                for (const key in jsonData) {
                    change(jsonData[key]);
                }
              }
        }
        change(jsonData);
    }

    static getInTreeIdAndType(element: Element): any[] {
        let type = element.getAttribute('type');
        let id = element.getAttribute('id');
        let result = [];
        if (id && type) {
            result = [{ id: id, type: type }];
        }
        for (var i = 0; i < element.children.length; i++) {
            const idsAndTypes = Utils.getInTreeIdAndType(element.children[i]);
            result = [...result, ...idsAndTypes];
        }
        return result;
    }

    static isNullOrUndefined(ele) {
        return (ele === null || ele === undefined) ? true : false;
    }

    // returns keys of enum
    static enumKeys(p): Array<string> {
        const keys = Object.keys(p);
        return keys;
    }

    // returns values of enum
    static enumValues(p): Array<string> {
        const keys = Object.keys(p);
        return keys.map(el => Object(p)[el]);
    }

    static getGUID(prefix: string = ''): string {
        var uuid = '', i, random;
        for (i = 0; i < 16; i++) {
            random = Math.random() * 16 | 0;
            if (i == 8) {
                uuid += '-';
            }
            uuid += (i == 12 ? 4 : (i == 16 ? (random & 3 | 8) : random)).toString(16);
        }
        return prefix + uuid;
    };

    static getShortGUID(prefix: string = ''): string {
        var uuid = '', i, random;
        for (i = 0; i < 12; i++) {
            random = Math.random() * 16 | 0;
            if (i == 8) {
                uuid += '-';
            }
            uuid += (i == 4 ? 4 : (i == 6 ? (random & 3 | 8) : random)).toString(12);
        }
        return prefix + uuid;
    }

    static getNextName(prefix: string, inuse: string[]) {
        let index = 1;
        let result = prefix + index;
        while (inuse.indexOf(result) >= 0) {
            index++;
            result = prefix + index;
        }
        return result;
    }

    static isObject(value) {
        return typeof (value) == 'object' && value !== null;
    }

    static getType(value: any) {
        return typeof value;
    }

    static getTextHeight(font) {
        // re-use canvas object for better performance
        var canvas = document.createElement('canvas');
        var context = canvas.getContext('2d');
        context.font = font;
        var metrics = context.measureText('M');
        return metrics.width;
    }

    static getDomTextHeight(size: number, font: string) {
        let text = document.createElement('span');
        document.body.appendChild(text);
        text.style.font = font;
        text.style.fontSize = size + 'px';
        text.style.height = 'auto';
        text.style.width = 'auto';
        text.style.position = 'absolute';
        text.style.whiteSpace = 'no-wrap';
        text.innerHTML = 'M';

        let height = Math.ceil(text.clientHeight);
        document.body.removeChild(text);
        return height;
    }

    static getEnumKey(etype: any, ekey: any) {
        return Object.keys(etype).find(key => etype[key] === ekey);
    }

    static isJson(item) {
        try {
            let obj = JSON.parse(item);
            if (obj && Object.keys(obj).length) {
                return true;
            }

        } catch (e) {
        }
        return false;
    }

    static isNumeric(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    }

    static Boolify(arg) {
        var BoolArray = [true, false, 'true', 'false', 1, 0];
        if (BoolArray.indexOf(arg) === -1) {
            return null;
        } else {
            return (arg == true || arg == 'true' || arg == 1) ? true : false;
        }
    }

    /**
     * check boolean and convert to number
     * @param value
     */
    static toNumber(value: any) {
        const b = Utils.Boolify(value);
        if (!Utils.isNullOrUndefined(b)) {
            return Number(b);
        }
        return value;
    }

    static formatValue(value: string, format: string): string {
        try {
            if (Utils.isNumeric(value)) {
                return numeral(value).format(format);
            }
        } catch (e) {
            console.error(e);
        }
        return value;
    }

    static arrayToObject = (array, keyField) => {
        array.reduce((obj, item) => {
            obj[item[keyField]] = item;
            return obj;
        }, {});
    };

    static rand(min, max) {
        min = min || 0;
        max = max || 0;
        this._seed = (this._seed * 9301 + 49297) % 233280;
        return Math.round(min + (this._seed / 233280) * (max - min));
    }

    static randNumbers(count, min, max) {
        let result = [];
        for (let i = 0; i < count; ++i) {
            result.push(this.rand(min, max));
        }
        return result;
    }

    static formatDate(date, format, utc?) {
        var MMMM = ['\x00', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        var MMM = ['\x01', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        var dddd = ['\x02', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        var ddd = ['\x03', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        let ii = (i, len?) => { var s = i + ''; len = len || 2; while (s.length < len) { s = '0' + s; } return s; };

        var y = utc ? date.getUTCFullYear() : date.getFullYear();
        format = format.replace(/(^|[^\\])yyyy+/g, '$1' + y);
        format = format.replace(/(^|[^\\])yy/g, '$1' + y.toString().substr(2, 2));
        format = format.replace(/(^|[^\\])y/g, '$1' + y);

        var M = (utc ? date.getUTCMonth() : date.getMonth()) + 1;
        format = format.replace(/(^|[^\\])MMMM+/g, '$1' + MMMM[0]);
        format = format.replace(/(^|[^\\])MMM/g, '$1' + MMM[0]);
        format = format.replace(/(^|[^\\])MM/g, '$1' + ii(M));
        format = format.replace(/(^|[^\\])M/g, '$1' + M);

        var d = utc ? date.getUTCDate() : date.getDate();
        format = format.replace(/(^|[^\\])dddd+/g, '$1' + dddd[0]);
        format = format.replace(/(^|[^\\])ddd/g, '$1' + ddd[0]);
        format = format.replace(/(^|[^\\])dd/g, '$1' + ii(d));
        format = format.replace(/(^|[^\\])d/g, '$1' + d);

        var H = utc ? date.getUTCHours() : date.getHours();
        format = format.replace(/(^|[^\\])HH+/g, '$1' + ii(H));
        format = format.replace(/(^|[^\\])H/g, '$1' + H);

        var h = H > 12 ? H - 12 : H == 0 ? 12 : H;
        format = format.replace(/(^|[^\\])hh+/g, '$1' + ii(h));
        format = format.replace(/(^|[^\\])h/g, '$1' + h);

        var m = utc ? date.getUTCMinutes() : date.getMinutes();
        format = format.replace(/(^|[^\\])mm+/g, '$1' + ii(m));
        format = format.replace(/(^|[^\\])m/g, '$1' + m);

        var s = utc ? date.getUTCSeconds() : date.getSeconds();
        format = format.replace(/(^|[^\\])ss+/g, '$1' + ii(s));
        format = format.replace(/(^|[^\\])s/g, '$1' + s);

        var f = utc ? date.getUTCMilliseconds() : date.getMilliseconds();
        format = format.replace(/(^|[^\\])fff+/g, '$1' + ii(f, 3));
        f = Math.round(f / 10);
        format = format.replace(/(^|[^\\])ff/g, '$1' + ii(f));
        f = Math.round(f / 10);
        format = format.replace(/(^|[^\\])f/g, '$1' + f);

        var T = H < 12 ? 'AM' : 'PM';
        format = format.replace(/(^|[^\\])TT+/g, '$1' + T);
        format = format.replace(/(^|[^\\])T/g, '$1' + T.charAt(0));

        var t = T.toLowerCase();
        format = format.replace(/(^|[^\\])tt+/g, '$1' + t);
        format = format.replace(/(^|[^\\])t/g, '$1' + t.charAt(0));

        var tz = -date.getTimezoneOffset();
        var K = utc || !tz ? 'Z' : tz > 0 ? '+' : '-';
        if (!utc) {
            tz = Math.abs(tz);
            var tzHrs = Math.floor(tz / 60);
            var tzMin = tz % 60;
            K += ii(tzHrs) + ':' + ii(tzMin);
        }
        format = format.replace(/(^|[^\\])K/g, '$1' + K);

        var day = (utc ? date.getUTCDay() : date.getDay()) + 1;
        format = format.replace(new RegExp(dddd[0], 'g'), dddd[day]);
        format = format.replace(new RegExp(ddd[0], 'g'), ddd[day]);

        format = format.replace(new RegExp(MMMM[0], 'g'), MMMM[M]);
        format = format.replace(new RegExp(MMM[0], 'g'), MMM[M]);

        format = format.replace(/\\(.)/g, '$1');

        return format;
    };

    static findBitPosition(n) {
        let result = [];
        for (let i = 0; i < 32; i++) {
            if (n & (0x01 << i)) {
                result.push(i);
            }
        }
        return result;
    }

    /**
     * set object values to target
     * @param target
     * @param sources
     * @returns
     */
    static assign = (target: { [key: string]: any }, ...sources: object[]) => {
        sources.forEach((source) => Object.keys(source).forEach((key) => {
            target[key] = source[key as keyof Object];
        }));
        return target;
    };

    static clone = (obj) => JSON.parse(JSON.stringify(obj));

    static convertArrayToObject = (array, value) => array.reduce((accumulator, key) => ({ ...accumulator, [key]: value }), {});

    static resizeView = (selector) => {
        document.querySelectorAll(selector).forEach((scaled: any) => {
            let parent = scaled.parentNode,
                ratioWidth = (parent.offsetWidth / scaled.offsetWidth),
                ratioHeight = (parent.offsetHeight / scaled.offsetHeight);
            scaled.style.transform = 'scale(' + Math.min(ratioWidth, ratioHeight) + ')';
            scaled.style.transformOrigin = 'top left';
        });
    };

    /** Merge of array of object, the next overwrite the last */
    static mergeDeep(...objArray) {
        const result = {};
        objArray.forEach((obj) => {
            if (obj) {
                Object.keys(obj).forEach((key) => {
                    if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                        result[key] = Utils.mergeDeep(result[key], obj[key]);
                    } else if (Array.isArray(obj[key])) {
                        if (!Array.isArray(result[key])) {
                            result[key] = [];
                        }
                        result[key] = result[key].concat(obj[key]);
                    } else {
                        result[key] = obj[key];
                    }
                });
            }
        });
        return result;
    };

    static copyToClipboard(text) {
        // Create a temporary textarea element
        const textarea = document.createElement('textarea');
        textarea.value = text;
        // Make the textarea hidden
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        // Append the textarea to the document
        document.body.appendChild(textarea);
        // Select and copy the text from the textarea
        textarea.select();
        document.execCommand('copy');
        // Remove the textarea from the document
        document.body.removeChild(textarea);
    }
}

@Pipe({
    name: 'enumToArray'
})
export class EnumToArrayPipe implements PipeTransform {

    transform(value): any {
        let result = [];
        var keys = Object.keys(value);
        var values = Object.values(value);
        for (var i = 0; i < keys.length; i++) {
            result.push({ key: keys[i], value: values[i] });
        }
        return result;
        //or if you want to order the result:
        //return result.sort((a, b) => a.value < b.value ? -1 : 1);
    }
}

@Pipe({ name: 'keepHtml', pure: false })
export class EscapeHtmlPipe implements PipeTransform {
    constructor(private sanitizer: DomSanitizer) {
    }

    transform(content) {
        return this.sanitizer.bypassSecurityTrustHtml(content);
    }
}
