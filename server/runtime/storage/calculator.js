/**
 *  Calculator for DAQ value array (integrale, max, min, average...) 
 */

'use strict';

/**
 * 
 * @param {*} values 
 * @param {*} fnc 
 * @param {*} collection hour / day 
 * @returns 
 */
function getMin(timeserie, fnc, collectionType) {
    let result = [];
    // sort to start with the oldest
    let sorted = timeserie.sort(function (a, b) {
        return a.dt - b.dt;
    });

    let addToCollection = (collections, collectionIndex, value) => {
        if (!collections[collectionIndex]) {
            collections[collectionIndex] = value;
        } else {
            collections[collectionIndex] += value;
        }
    }

    let getCollectionTime = (millyDt, _collection, next) => {
        let dt = new Date(millyDt);
        let toadd = (next) ? 1 : 0;
        if (_collection === ReportIntervalType.day) {
            dt = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + toadd, 0, 0, 0);
        } else if (_collection === ReportIntervalType.hour) {
            dt = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), dt.getHours() + toadd, 0, 0);
        }
        return dt;
    }
    
    let lastRecord = null;// : TimeValue { dt: number, value: number };
    let lastCollectionIndex = null;
    for (let i = 0; i < sorted.length; i++) {
        let collectionIndex = getCollectionTime(sorted[i].dt, collectionType, false).getTime();
        // check missing value to fill collectionsIndex
        while (lastCollectionIndex && lastCollectionIndex < collectionIndex) {
            let nextCollectionIndex = getCollectionTime(lastRecord.dt, collectionType, true).getTime();
            let delta = nextCollectionIndex - lastRecord.dt;
            addToCollection(result, nextCollectionIndex, lastRecord.value * (delta / 1000));
            lastCollectionIndex = nextCollectionIndex;
            lastRecord.dt = nextCollectionIndex;
            // console.log(`last Record:${new Date(lastRecord.datetime)}`);
        }
        // sum left => skip the first one
        if (lastRecord) {
            let delta = sorted[i].dt - lastRecord.dt;
            addToCollection(result, collectionIndex, sorted[i].value * (delta / 1000));
        }

        lastRecord = sorted[i];
        // console.log(`last Record:${new Date(lastRecord.datetime)}`);
        lastCollectionIndex = collectionIndex;
    }
    return result;
}

function getMax(values, fnc, interval) {
    let result = [];
    // // sort to start with the oldest
    // let sorted = timeserie.sort(function (a, b) {
    //     return a.dt - b.dt;
    // });

    // let addToCollection = (collections: number[], collectionIndex: number, value: number) => {
    //     if (!collections[collectionIndex]) {
    //         collections[collectionIndex] = value;
    //     } else {
    //         collections[collectionIndex] += value;
    //     }
    //     // console.log(`add: ${new Date(collectionIndex)} + ${value} = ${collections[collectionIndex]}`);
    // }

    // let getCollectionTime = (millyDt: number, collectionType: ReportIntervalType, next) => {
    //     let dt = new Date(millyDt);
    //     let toadd = (next) ? 1 : 0;
    //     if (collectionType === CollectionType.Year) {
    //         dt = new Date(dt.getFullYear() + toadd, 0, 0, 0, 0, 0);
    //     } else if (collectionType === CollectionType.Month) {
    //         dt = new Date(dt.getFullYear(), dt.getMonth() + toadd, 0, 0, 0, 0);
    //     } else if (collectionType === CollectionType.Day) {
    //         dt = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + toadd, 0, 0, 0);
    //     } else if (collectionType === CollectionType.Hour) {
    //         dt = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), dt.getHours() + toadd, 0, 0);
    //     } else if (collectionType === CollectionType.Minute) {
    //         dt = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), dt.getHours(), dt.getMinutes() + toadd, 0);
    //     } else if (collectionType === CollectionType.Second) {
    //         dt = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), dt.getHours(), dt.getMinutes(), dt.getSeconds() + toadd);
    //     }
    //     // console.log(`in:${new Date(millyDt)}   ${dt}`);
    //     return dt;
    // }
    
    // let lastRecord: TimeValue = null;
    // let lastCollectionIndex = null;
    // for (let i = 0; i < sorted.length; i++) {
    //     let collectionIndex = getCollectionTime(sorted[i].dt, collectionType, false).getTime();
    //     // check missing value to fill collectionsIndex
    //     while (lastCollectionIndex && lastCollectionIndex < collectionIndex) {
    //         let nextCollectionIndex = getCollectionTime(lastRecord.dt, collectionType, true).getTime();
    //         let delta = nextCollectionIndex - lastRecord.dt;
    //         addToCollection(result, nextCollectionIndex, lastRecord.value * (delta / 1000));
    //         lastCollectionIndex = nextCollectionIndex;
    //         lastRecord.dt = nextCollectionIndex;
    //         // console.log(`last Record:${new Date(lastRecord.datetime)}`);
    //     }
    //     // sum left => skip the first one
    //     if (lastRecord) {
    //         let delta = sorted[i].dt - lastRecord.dt;
    //         addToCollection(result, collectionIndex, sorted[i].value * (delta / 1000));
    //     }

    //     lastRecord = sorted[i];
    //     // console.log(`last Record:${new Date(lastRecord.datetime)}`);
    //     lastCollectionIndex = collectionIndex;
    // }
    // // calculates with unit
    // if (unit) {
    //     Object.keys(result).forEach(k => {
    //         result[k] /= unit;
    //     });
    // }
    return result;
}

function getAverage(values, fnc, interval) {
}

function getSum(values, fnc, interval) {
}

module.exports = {
    getMin: getMin,
    getMax: getMax,
    getAverage: getAverage,
    getSum: this.getSum,
};

const ReportIntervalType = {
    hour: 'hour',
    day: 'day',
}

const ReportFunctionType = {
    min: 'min',
    max: 'max',
    average: 'average',
    sum: 'sum',
}
