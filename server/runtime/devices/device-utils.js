'use strict';
const utils = require('../utils');
const dayjs = require('dayjs');
const duration = require('dayjs/plugin/duration');
dayjs.extend(duration);

module.exports = {

    tagDaqToSave: function (tag, timestamp) {
        if (tag.daq && (tag.daq.enabled || tag.daq.restored)) {
            tag.timestamp = timestamp;
            if (tag.changed && (tag.daq.changed || tag.daq.restored)) {
                return true;
            } else if (!tag.daq.lastDaqSaved || (tag.daq.interval && timestamp - parseInt(tag.daq.interval) * 1000 > tag.daq.lastDaqSaved)) {
                tag.daq.lastDaqSaved = timestamp;
                return true;
            }
        }
        return false;
    },

    tagValueCompose: async function (value, tag, runtime = undefined) {
        var obj = {value: null };
        value = await callScaleScript(tag.scaleReadFunction, tag.scaleReadParams, runtime, true, value);
     
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

    tagRawCalculator: async function (value, tag, runtime = undefined) {
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
        value = await callScaleScript(tag.scaleWriteFunction, tag.scaleWriteParams, runtime, false, value);
        
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

const callScaleScript = async (scriptId, params, runtime, isRead, value) => {
    if (scriptId && runtime !== undefined) {
        let parameters = [
            { name: 'value', type: 'value', value: value }
        ];
        let tagParams = [];
        if (params) {
            try {
                tagParams = JSON.parse(params);
            } catch (error) {
                runtime.logger.error(`'${tag.name}' error decoding ${isRead ? 'read' : 'write' } scale script params ${error.toString()}`);
            }
            parameters = [...parameters, ...tagParams];
        }
        const script = {
            id: scriptId,
            name: null,
            parameters: parameters
        };
        try {
            value = await runtime.scriptsMgr.runScript(script);
        } catch (error) {
            runtime.logger.error(`'${tag.name}' ${isRead ? 'read' : 'write'} script error! ${error.toString()}`);
        }
        return value;
    }
}