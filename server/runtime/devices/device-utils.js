'use strict';
const utils = require('../utils');
const dayjs = require('dayjs');
const duration = require('dayjs/plugin/duration');
dayjs.extend(duration);

module.exports = {

    tagDaqToSave: function (tag, timestamp) {
        if (tag.daq && tag.daq.enabled) {
            tag.timestamp = timestamp;
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
        var obj = {value: null };
        if (tag && utils.isNumber(value, obj)) {
            try {
                value = obj.value;
                if (tag.scale) {
                    if (tag.scale.mode === 'linear') {
                        value = (tag.scale.scaledHigh - tag.scale.scaledLow) * (value - tag.scale.rawLow) / (tag.scale.rawHigh - tag.scale.rawLow) + tag.scale.scaledLow;
                    } else if (tag.scale.mode === 'convertDateTime' && tag.scale.dateTimeFormat) {
                        value = dayjs(value).format(tag.scale.dateTimeFormat);
                    } else if (tag.scale.mode === 'convertTickTime' && tag.scale.dateTimeFormat) {
                        value = durationToTimeFormat(dayjs.duration(value), tag.scale.dateTimeFormat);
                    }
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
        var obj = {value: null };
        if (tag && utils.isNumber(value, obj)) {
            try {
                value = obj.value;
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

const durationToTimeFormat = (duration, format) => {
  const pattern = /^([H]+)?([:|-])?([m]+)?([:|-])?([s]+)?$/;
  const match = format.match(pattern);

  if (!match) {
    return null; // Format not valid
  }

  const [, hoursPart, separator1, minutePart, separator2, secondPart] = match;

  const nbDays = duration.get('days');
  const nbHours = duration.get('hours');
  const nbMinutes = duration.get('minute');
  const nbSeconds = duration.get('seconds');

  var count = nbDays * 24 + nbHours;
  var result = '';
  if (hoursPart) {
    result += `${count.toString().padStart(hoursPart.length, '0')}${separator1 ?? ''}`;
    count = nbMinutes;
  } else {
    count = count * 60 + nbMinutes;
  }
  if (minutePart) {
    result += `${count.toString().padStart(minutePart.length, '0')}${separator2 ?? ''}`;
    count = nbSeconds;
  } else {
    count = count * 60 + nbSeconds;
  }
  if (secondPart) {
    result += `${count.toString().padStart(secondPart.length, '0')}`;
  }
  return result;
}