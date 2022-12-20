'use strict';

module.exports = {

    tagDaqToSave: function (tag, timestamp) {
        if (tag.daq && tag.daq.enabled) {
            const a = timestamp - parseInt(tag.daq.interval) * 1000;
            if (tag.changed && tag.daq.changed) {
                return true;
            } else if (!tag.daq.lastDaqSaved || timestamp - parseInt(tag.daq.interval) * 1000 > tag.daq.lastDaqSaved) {
                tag.daq.lastDaqSaved = timestamp;
                return true;
            }
        }
        return false;
    },

    tagValueCompose: function (value, tag) {
        if (value && tag) {
            try {
                value = parseFloat(value);
                if (tag.scale && tag.scale.mode === 'linear') {
                    value = (tag.scale.scaledHigh - tag.scale.scaledLow) * (value - tag.scale.rawLow) / (tag.scale.rawHigh - tag.scale.rawLow) + tag.scale.scaledLow;
                }
                if (tag.format) {
                    value = +value.toFixed(tag.format);
                }
            } catch (err) { 
                console.error(err);
            }
        }
        return value;
    },

    tagRawCalculator: function (value, tag) {
        if (value && tag) {
            try {
                value = parseFloat(value);
                if (tag.scale && tag.scale.mode === 'linear') {
                    value = tag.scale.rawLow + ((tag.scale.rawHigh - tag.scale.rawLow) * (value - tag.scale.scaledLow)) / (tag.scale.scaledHigh - tag.scale.scaledLow);
                }
            } catch (err) { 
                console.error(err);
            }
        }
        return value;
    }
}