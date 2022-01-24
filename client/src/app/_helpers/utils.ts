import { Injectable, Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

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
        var uuid = "", i, random;
        for (i = 0; i < 16; i++) {
            random = Math.random() * 16 | 0;
            if (i == 8) {
                uuid += "-"
            }
            uuid += (i == 12 ? 4 : (i == 16 ? (random & 3 | 8) : random)).toString(16);
        }
        return prefix + uuid; 
    };

    static getShortGUID(prefix: string = ''): string {
        var uuid = "", i, random;
        for (i = 0; i < 12; i++) {
            random = Math.random() * 16 | 0;
            if (i == 8) {
                uuid += "-"
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
        var canvas = document.createElement("canvas");
        var context = canvas.getContext("2d");
        context.font = font;
        var metrics = context.measureText('M');
        return metrics.width;
    }

    static getDomTextHeight(size: number, font: string) {
        let text = document.createElement("span");
        document.body.appendChild(text);
        text.style.font = font;
        text.style.fontSize = size + "px";
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

    static arrayToObject = (array, keyField) => {
        array.reduce((obj, item) => {
            obj[item[keyField]] = item
            return obj
        }, {});
    }

    static rand(min, max) {
        min = min || 0;
        max = max || 0;
        this._seed = (this._seed * 9301 + 49297) % 233280;
        return Math.round(min + (this._seed / 233280) * (max - min));
    }

    static randNumbers(count, min, max) {
        let result = [];
        for (let i = 0; i < count; ++i) {
            result.push(this.rand(min, max))
        }
        return result;
    }
}

@Pipe({
    name: 'enumToArray'
})
export class EnumToArrayPipe implements PipeTransform {

    transform(value, args: string[]): any {
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
