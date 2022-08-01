const os = require('os');
const ip = require('ip');

'use strict';
var utils = module.exports = {

    domStringSplitter: function (src, tagsplitter, first) {
        var result = { before: '', tagcontent: '', after: '' };
        var tagStart = '<' + tagsplitter.toLowerCase();
        var tagEnd = '</' + tagsplitter.toLowerCase(); 
        var text = src.toLowerCase();
        var start = text.indexOf(tagStart, first);
        var end = text.indexOf(tagEnd, start);
        result.before = src.slice(0, start);
        result.tagcontent = src.slice(start, end);
        result.after = src.slice(end);
        return result;
    },

    domStringSetAttribute: function (src, tags, attribute) {
        var result = src;
        for (var i = 0; i < tags.length; i++) {
            var text = result.toLowerCase();
            var tagStart = '<' + tags[i].toLowerCase();
            var pos = 0;
            var temp  = '';
            while((pos = text.indexOf(tagStart, pos)) !== -1) {
                pos += tagStart.length + 1;
                temp += src.slice(0, pos) + attribute + ' ' + src.slice(pos);
            }
            if (temp.length) {
                result = temp;
            }
        }
        return result;
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
                        if (iface.interal === true) return;
                        if (iface.family !== 'IPv4') return;
                        nics.push({
                            name: ifname,
                            address: iface.address,
                            broadcast: ip.subnet(iface.address, iface.netmask).broadcastAddress
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
        return value && Object.keys(value).length === 0 && value.constructor === Object;
    },

    isNullOrUndefined: function (ele) {
        return (ele === null || ele === undefined) ? true : false;
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
    }
}