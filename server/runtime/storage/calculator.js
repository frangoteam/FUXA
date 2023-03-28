/**
 *  Calculator for DAQ value array (integrale, max, min, average...) 
 */

'use strict';

const utils = require("../utils");

function getFunctionValues(values, fromts, tots, fnc, interval, format) {
    if (fnc === ReportFunctionType.min) {
        return getMin(values, fromts, tots, interval);
    } else if (fnc === ReportFunctionType.max) {
        return getMax(values, fromts, tots, interval);
    } else if (fnc === ReportFunctionType.average) {
        return getAverage(values, fromts, tots, interval, format);
    } else if (fnc === ReportFunctionType.sum) {
        return getSum(values, fromts, tots, interval);
    }
}

/**
 * 
 * @param {*} values 
 * @param {*} fnc 
 * @param {*} intervalType hour / day 
 * @returns 
 */
function getMin(timeserie, fromts, tots, intervalType) {
    let result = getInterval(fromts, tots, intervalType, Number.MAX_VALUE);
    // sort to start with the oldest
    let sorted = timeserie.sort(function (a, b) {
        return a.dt - b.dt;
    });

    let addToInterval = (intervals, intervalIndex, value) => {
        if (!intervals[intervalIndex]) {
            intervals[intervalIndex] = Number.MAX_VALUE;
        } else if (intervals[intervalIndex] > value) {
            intervals[intervalIndex] = value;
        }
    }
    
    for (let i = 0; i < sorted.length; i++) {
        let intervalIndex = getIntervalTime(sorted[i].dt, intervalType, false).getTime();
        addToInterval(result, intervalIndex, utils.parseFloat(sorted[i].value, 5));
    }
    return result;
}

function getMax(timeserie, fromts, tots, intervalType) {
    let result = getInterval(fromts, tots, intervalType, utils.SMALLEST_NEGATIVE_INTEGER);
    // sort to start with the oldest
    let sorted = timeserie.sort(function (a, b) {
        return a.dt - b.dt;
    });

    let addToInterval = (intervals, intervalIndex, value) => {
        if (!intervals[intervalIndex]) {
            intervals[intervalIndex] = utils.SMALLEST_NEGATIVE_INTEGER;
        } else if (intervals[intervalIndex] < value) {
            intervals[intervalIndex] = value;
        }
    }
    
    for (let i = 0; i < sorted.length; i++) {
        let intervalIndex = getIntervalTime(sorted[i].dt, intervalType, false).getTime();
        addToInterval(result, intervalIndex, utils.parseFloat(sorted[i].value, 5));
    }
    return result;
}

function getAverage(timeserie, fromts, tots, intervalType, format) {
    let result = getInterval(fromts, tots, intervalType, null);
    let counts = getInterval(fromts, tots, intervalType, 0);
    // sort to start with the oldest
    let sorted = timeserie.sort(function (a, b) {
        return a.dt - b.dt;
    });

    let addToInterval = (intervals, counters, intervalIndex, value) => {
        if (utils.isNullOrUndefined(intervals[intervalIndex])) {
            intervals[intervalIndex] = value;
        } else {
            intervals[intervalIndex] += value;
        }
        counters[intervalIndex]++;
    }
    
    for (let i = 0; i < sorted.length; i++) {
        let intervalIndex = getIntervalTime(sorted[i].dt, intervalType, false).getTime();
        addToInterval(result, counts, intervalIndex, parseFloat(sorted[i].value));
    }
    // average
    Object.keys(result).forEach(k => {
        if (counts[k]) {
            result[k] = utils.parseFloat(result[k] / counts[k], format || 5);
        }
    });
    return result; 
}

function getSum(timeserie, fromts, tots, intervalType) {
    let result = getInterval(fromts, tots, intervalType, 0);
    // sort to start with the oldest
    let sorted = timeserie.sort(function (a, b) {
        return a.dt - b.dt;
    });

    let addToInterval = (intervals, intervalIndex, value) => {
        if (utils.isNullOrUndefined(intervals[intervalIndex])) {
            intervals[intervalIndex] = 0;
        } else {
            intervals[intervalIndex] += value;
            intervals[intervalIndex] = utils.parseFloat(intervals[intervalIndex], 5)
        }
    }
    
    for (let i = 0; i < sorted.length; i++) {
        let intervalIndex = getIntervalTime(sorted[i].dt, intervalType, false).getTime();
        addToInterval(result, intervalIndex, parseFloat(sorted[i].value));
    }
    return result;    
}


function getIntegral(timeserie, fromts, tots, intervalType) {
    let result = getInterval(fromts, tots, intervalType, Number.MAX_VALUE);
    // sort to start with the oldest
    let sorted = timeserie.sort(function (a, b) {
        return a.dt - b.dt;
    });

    let addToInterval = (intervals, intervalIndex, value) => {
        if (!intervals[intervalIndex]) {
            intervals[intervalIndex] = value;
        } else if (intervals[intervalIndex] > value) {
            intervals[intervalIndex] += value;
        }
    }
    
    let lastRecord = null;// : TimeValue { dt: number, value: number };
    let lastIntervalIndex = null;
    for (let i = 0; i < sorted.length; i++) {
        let intervalIndex = getIntervalTime(sorted[i].dt, intervalType, false).getTime();
        // check missing value to fill intervalsIndex
        while (lastIntervalIndex && lastIntervalIndex < intervalIndex) {
            let nextIntervalIndex = getIntervalTime(lastRecord.dt, intervalType, true).getTime();
            let delta = nextIntervalIndex - lastRecord.dt;
            addToInterval(result, nextIntervalIndex, parseFloat(lastRecord.value) * (delta / 1000));
            lastIntervalIndex = nextIntervalIndex;
            lastRecord.dt = nextIntervalIndex;
        }
        // sum left => skip the first one
        if (lastRecord) {
            let delta = sorted[i].dt - lastRecord.dt;
            addToInterval(result, intervalIndex, parseFloat(sorted[i].value) * (delta / 1000));
        }

        lastRecord = sorted[i];
        lastIntervalIndex = intervalIndex;
    }
    return result;
}

function getInterval(fromts, tots, type, defvalue) {
    let result = {};
    let dt = getStepDate(fromts, type, 0);
    while (dt.getTime() < tots) {
        result[dt.getTime()] = defvalue;
        dt = getStepDate(dt, type, 1);
    }
    return result;
}

function getIntervalTime(millyDt, _interval, next) {
    let dt = new Date(millyDt);
    let toadd = (next) ? 1 : 0;
    return getStepDate(dt, _interval, toadd);
}

function getStepDate(ts, type, toadd) {
    var dtRange;
    let dt = new Date(ts);
    if (type === ReportIntervalType.day) {
        dtRange = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 0, 0, 0);
        dtRange.setDate(dt.getDate() + toadd);
    } else if (type === ReportIntervalType.hour) {
        dtRange = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), dt.getHours(), 0, 0);
        dtRange.setHours(dt.getHours() + toadd);
    } else if (type === ReportIntervalType.min30) {
        dtRange = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), dt.getHours(), 0, 0);
        var minutesRange = parseInt(dt.getMinutes() / 30);
        dtRange.setMinutes((minutesRange + toadd) * 30);
    } else if (type === ReportIntervalType.min10) {
        dtRange = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), dt.getHours(), 0, 0);
        var minutesRange = parseInt(dt.getMinutes() / 10);
        dtRange.setMinutes((minutesRange + toadd) * 10);
    } else { //if (type === ReportIntervalType.min5) {
        dtRange = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), dt.getHours(), 0, 0);
        var minutesRange = parseInt(dt.getMinutes() / 5);
        dtRange.setMinutes((minutesRange + toadd) * 5);
    }
    return dtRange;
}

module.exports = {
    getFunctionValues: getFunctionValues,
    getMin: getMin,
    getMax: getMax,
    getAverage: getAverage,
    getSum: this.getSum,
};

const ReportIntervalType = {
    min5: 'min5',
    min10: 'min10',
    min30: 'min30',
    hour: 'hour',
    day: 'day',
}

const ReportFunctionType = {
    min: 'min',
    max: 'max',
    average: 'average',
    sum: 'sum',
}
