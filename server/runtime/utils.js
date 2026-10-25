const os = require('os');
const crypto = require('crypto');

function ipv4ToInt(address) {
    return address.split('.').reduce((result, octet) => {
        return ((result << 8) + Number(octet)) >>> 0;
    }, 0);
}

function intToIpv4(value) {
    return [
        (value >>> 24) & 255,
        (value >>> 16) & 255,
        (value >>> 8) & 255,
        value & 255
    ].join('.');
}

function getBroadcastAddress(address, netmask) {
    const addressInt = ipv4ToInt(address);
    const netmaskInt = ipv4ToInt(netmask);
    return intToIpv4((addressInt | (~netmaskInt >>> 0)) >>> 0);
}

'use strict';
var utils = module.exports = {

    SMALLEST_NEGATIVE_INTEGER: -9007199254740991,

    domStringSplitter: function (src, tagsplitter, first) {
        var result = { before: '', tagcontent: '', after: '' };
        var tagStart = '<' + tagsplitter.toLowerCase();
        var tagEnd = '</' + tagsplitter.toLowerCase();
        var text = src.toLowerCase();
        var start = text.indexOf(tagStart, first);
        if (start === -1) {
            result.before = src;
            return result;
        }
        var end = text.indexOf(tagEnd, start);
        result.before = src.slice(0, start);
        result.tagcontent = end === -1 ? src.slice(start) : src.slice(start, end);
        result.after = end === -1 ? '' : src.slice(end);
        return result;
    },

    domStringSetAttribute: function (src, tags, attribute) {
        const selected = new Set(tags.map(tag => tag.toLowerCase()));
        const attributeName = attribute.trim().match(/^[^\s=/>]+/)[0].toLowerCase();
        let rawTextTag = null;
        // Keep quoted attribute values, comments and CDATA intact. In particular,
        // tag-like text inside an attribute must not become a second control.
        const tokens = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\/?[a-z][a-z0-9:-]*(?=[\s/>])(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi;
        return src.replace(tokens, token => {
            const match = token.match(/^<(\/?)([a-z][a-z0-9:-]*)/i);
            if (!match) return token;
            const name = match[2].toLowerCase();
            if (rawTextTag) {
                if (match[1] && name === rawTextTag) rawTextTag = null;
                return token;
            }
            if (match[1]) return token;
            if (['script', 'style', 'textarea', 'title'].includes(name)) rawTextTag = name;
            if (!selected.has(name)) return token;

            const tail = token.slice(match[0].length);
            const attributes = /\s+([^\s=/>]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/g;
            let existing;
            while ((existing = attributes.exec(tail)) !== null) {
                if (existing[1].toLowerCase() === attributeName) return token;
            }
            return match[0] + ' ' + attribute + (/^\s/.test(tail) ? '' : ' ') + tail;
        });
    },

    domStringSetOverlay: function (htmlString, tagNames) {
        tagNames.forEach(tagName => {
            const lowerTagName = tagName.toLowerCase();
            const regex = new RegExp(`(<${lowerTagName}[^>]*?>.*?</${lowerTagName}>)`, "gis");
            const style = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); z-index: 9999; pointer-events: all; display: none;";
            htmlString = htmlString.replace(regex, `<div style="${style}">$1</div>`);
        });

        return htmlString;
    },

    /**
    * Return available interface to use
    */
    getHostInterfaces: function() {
        return new Promise(function (resolve, reject) {
            try {
                let nics = [];
                const osNics = os.networkInterfaces();
                nics.push({ name: 'Default' });
                Object.keys(osNics).forEach((ifname) => {
                    osNics[ifname].forEach((iface) => {
                        if (iface.internal === true) return;
                        if (iface.family !== 'IPv4') return;
                        nics.push({
                            name: ifname,
                            address: iface.address,
                            broadcast: getBroadcastAddress(iface.address, iface.netmask)
                        });
                    });
                });
                resolve(nics);
            } catch (err) {
                reject('gethostinterfaces-error: ' + err);
            }
        });
    },

    endTime: function (startTime) {
        var endTime = new Date();
        return endTime - startTime;
    },

    isEmptyObject: function (value) {
        return !value || (Object.keys(value).length === 0 && value.constructor === Object);
    },

    isObject(value) {
        var type = typeof value;
        return !!value && (type == 'object' || type == 'function');
    },

    isBoolean(value) {
        return (typeof value === 'boolean');
    },

    isPlainObject(value) {
        var Ctor;
        if (!(isObjectLike(value) && objToString.call(value) == objectTag && !isHostObject(value) && !isArguments(value)) ||
            (!hasOwnProperty.call(value, 'constructor') && (Ctor = value.constructor, typeof Ctor == 'function' && !(Ctor instanceof Ctor)))) {
          return false;
        }
        var result;
        if (lodash.support.ownLast) {
          baseForIn(value, function(subValue, key, object) {
            result = hasOwnProperty.call(object, key);
            return false;
          });
          return result !== false;
        }
        baseForIn(value, function(subValue, key) {
          result = key;
        });
        return result === undefined || hasOwnProperty.call(value, result);
    },

    isNullOrUndefined: function (ele) {
        return (ele === null || ele === undefined) ? true : false;
    },

    JsonTryToParse(value) {
        try {
            if (value) {
                return JSON.parse(value);
            }
        } catch { }
    },

    mergeObjectsValues: function (obj1, obj2) {
        if (typeof obj1 === 'object' && typeof obj2 === 'object') {
            for (let key in obj2) {
                if (obj1.hasOwnProperty(key)) {
                    obj1[key] = obj2[key];
                }
            }
        }
        return obj1;
    },

    dayOfYear: function (date) {
        if (date) {
            return Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
        }
        return -1;
    },

    getDate: function (dt) {
        var yyyy = dt.getFullYear();
        var mm = dt.getMonth() + 1;
        var dd = dt.getDate();
        if (dd < 10) {
            dd = '0' + dd;
        }
        if (mm < 10) {
            mm = '0' + mm;
        }
        var HH = dt.getHours();
        var MM = dt.getMinutes();
        var SS = dt.getSeconds();
        if (HH < 10) {
            HH = '0' + HH;
        }
        if (MM < 10) {
            MM = '0' + MM;
        }
        if (SS < 10) {
            SS = '0' + SS;
        }
        return `${yyyy}-${mm}-${dd}_${HH}-${MM}-${SS}`;
    },

    getFormatDate: function (dt, format) {
        var yyyy = dt.getFullYear();
        var mm = dt.getMonth() + 1;
        var dd = dt.getDate();
        if (dd < 10) {
            dd = '0' + dd;
        }
        if (mm < 10) {
            mm = '0' + mm;
        }
        var HH = dt.getHours();
        var MM = dt.getMinutes();
        var SS = dt.getSeconds();
        if (HH < 10) {
            HH = '0' + HH;
        }
        if (MM < 10) {
            MM = '0' + MM;
        }
        if (SS < 10) {
            SS = '0' + SS;
        }
        if (format === 'ymd') {
            return `${yyyy}/${mm}/${dd}/ ${HH}:${MM}:${SS}`;
        }
        return `${dd}/${mm}/${yyyy} ${HH}:${MM}:${SS}`;
    },

    isNumber: function(n, v = {value: null}) {
        if (typeof n === 'number') {
            v.value = n;
            return true;
        } else {
            var num = Number(n);
            if (isNaN(num)) {
                return false;
            }
            num = parseFloat(n);
            if (isNaN(num)) {
                return false;
            }
            v.value = num;
            return true;
        }
    },

    isFloat: function (n) {
        return Number(n) === n && n % 1 !== 0;
    },

    parseFloat: function (value, decimals) {
        if (this.isFloat(value)) {
            return parseFloat(value.toFixed(decimals));
        } else {
            return parseFloat(value);
        }
    },

    isValidRange: function (min, max) {
        if (this.isNumber(min) && this.isNumber(max)) {
            return true;
        }
        return false;
    },

    chunkArray: function (array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
          chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    },

    chunkTimeRange: (start, end, chunkSize) => {
        const chunks = [];
        let currentStart = start;
        if (chunkSize < 1) {
            return [{ start: start, end: end }];
        }
        while (currentStart < end) {
            const currentEnd = Math.min(currentStart + chunkSize, end);
            chunks.push({ start: currentStart, end: currentEnd });
            currentStart = currentEnd;
        }
        return chunks;
    },

    extractArray: function (object) {
        let index = 0;
        const array = [];

        while (object[index] !== undefined) {
            array.push(object[index]);
            index++;
        }
        return array;
    },

    getNetworkInterfaces: function () {
        const interfaces = os.networkInterfaces();
        var result = [];
        Object.keys(interfaces).forEach((interfaceName) => {
            interfaces[interfaceName].forEach((iface) => {
                if (iface.internal === true) return;
                if (iface.family !== 'IPv4') return;
                result.push(iface.address);
            });
        });
        return result;
    },

    getRetentionLimit: function(retention) {
        var dayToAdd = 0;
        if (retention === 'day1') {
            dayToAdd = 1;
        } else if (retention === 'days2') {
            dayToAdd = 2;
        } else if (retention === 'days3') {
            dayToAdd = 3;
        } else if (retention === 'days7') {
            dayToAdd = 7;
        } else if (retention === 'days14') {
            dayToAdd = 14;
        } else if (retention === 'days30') {
            dayToAdd = 30;
        } else if (retention === 'days90') {
            dayToAdd = 90;
        } else if (retention === 'year1') {
            dayToAdd = 365;
        } else if (retention === 'year3') {
            dayToAdd = 365 * 3;
        } else if (retention === 'year5') {
            dayToAdd = 365 * 5;
        }
        const date = new Date();
        date.setDate(date.getDate() - dayToAdd);
        return date;
    },
    /**
     * Check and parse the value return converted value
     * @param {*} value as string
     */
    parseValue: function(value, type){
        if (type === 'number') {
            return parseFloat(value);
        } else if (type === 'boolean') {
            if (typeof value === 'string') {
                return value.toLowerCase() !== 'false';
            }
            return Boolean(value);
        } else if (type === 'string') {
            return value;
        } else {
            let val = parseFloat(value);
            if (Number.isNaN(val)) {
                // maybe boolean
                val = Number(value);
                // maybe string
                if (Number.isNaN(val)) {
                    val = value;
                }
            } else {
                val = parseFloat(val.toFixed(5));
            }
            return val;
        }
    },

    deepMerge: function(source, target) {
        for (const key in source) {
            if (!Object.prototype.hasOwnProperty.call(target, key)) {
                target[key] = source[key];
            } else {
                const sourceVal = source[key];
                const targetVal = target[key];

                if (
                    typeof sourceVal === 'object' &&
                    sourceVal !== null &&
                    !Array.isArray(sourceVal) &&
                    typeof targetVal === 'object' &&
                    targetVal !== null &&
                    !Array.isArray(targetVal)
                ) {
                    deepMerge(sourceVal, targetVal);
                }
            }
        }
        return target;
    },

    generateSecretCode: function(byteLength = 32) {
        return crypto.randomBytes(byteLength).toString('hex');
    }
}
