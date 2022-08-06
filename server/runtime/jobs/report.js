/*
* Report: get data, create/send/store pdf
*/
const { ResultFlags } = require('node-bacnet/lib/enum');
var utils = require('../utils');
const Pdfmake = require('pdfmake');
var fs = require('fs')
var path = require('path');

'use strict';

function Report(_property, _runtime) {
    var property = _property;
    var runtime = _runtime;
    var logger = runtime.logger;
    var currentTime = 0;
    var lastExecuted;

    this.execute = function (time, force) {
        currentTime = time;
        return new Promise(function (resolve, reject) {
            try {
                if (!_isToExecute(time) && !force) {
                    resolve(true);
                } else {
                    _createPdfBinary().then(filepath => {
                        if (property.receiver) {
                            let subject = `Report ${property.name}`;
                            let attachments = { path: filepath };
                            runtime.notificatorMgr.sendMailMessage(null, property.receiver, subject, '', null, attachments).then(function () {
                                logger.info(`report.sended.successful: ${new Date()} ${property.receiver} ${property.name}`);
                            }).catch(function (senderr) {
                                logger.error(`report.send.failed: ${senderr}`);
                            });
                        }
                        resolve(filepath);
                    }).catch(function (err) {
                        reject(err);
                    });
                }
            } catch (err) {
                reject(err);
            }  
        });
    }

    this.getProperty = function () {
        return property;
    }

    var _isToExecute = function (date) {
        if (inTimeToExecute(date.getHours()) && utils.dayOfYear(lastExecuted) !== utils.dayOfYear(date)) {
            if (property.scheduling === ReportSchedulingType.day) {
                return true;
            } else if (property.scheduling === ReportSchedulingType.week && date.getDay() === 1) {      // monday
                return true;
            } else if (property.scheduling === ReportSchedulingType.month && date.getDate() === 1) {
                return true;
            }
        }
        return false;
    }

    var _createPdfBinary = function () {
        return new Promise(function (resolve, reject) {
            var fonts = {
                Roboto: {
                    normal: path.join(__dirname, 'fonts/Roboto-Regular.ttf'),
                    bold: path.join(__dirname, 'fonts/Roboto-Medium.ttf'),
                    italics: path.join(__dirname, 'fonts/Roboto-Italic.ttf'),
                    bolditalics: path.join(__dirname, 'fonts/Roboto-MediumItalic.ttf')
                }
              };
            let pdfmake = new Pdfmake(fonts);
            _getPdfContent(property).then(content => {
                let docPath = path.join(runtime.settings.reportsDir,`${property.name}_${utils.getDate(new Date())}.pdf`);
                pdfDoc = pdfmake.createPdfKitDocument(content, {});
                const stream = fs.createWriteStream(docPath);
                pdfDoc.pipe(stream);
                pdfDoc.end();
                stream.on("finish", function() {
                    resolve(docPath);
                });
            }).catch(function (err) {
                reject(err);
            });
        });
    }

    var _getPdfContent = function (report) {
        return new Promise(async function (resolve, reject) {
            try {
                let docDefinition = {...report.docproperty };
                docDefinition['header'] = 'FUXA powered by frangoteam';
                docDefinition['content'] = [];
                for (let i = 0; i < report.content.items.length; i++) {
                    let item = report.content.items[i];
                    if (item.type === 'text') {
                        docDefinition['content'].push({ text: item.text });
                    } else if (item.type === 'table') {
                        await _getTableContent(item).then(itemTable => {
                            const tableDateRange = _getDateRange(item.range);
                            docDefinition['content'].push({ text: `${tableDateRange.begin.toLocaleDateString()} - ${tableDateRange.end.toLocaleDateString()}` });
                            docDefinition['content'].push(itemTable);
                        });
                    }
                }
                resolve(docDefinition);
            } catch (err) {
                reject(err);
            }
        });
    }

    var _getTableContent = function (item) {
        return new Promise(async function (resolve, reject) {
            let content = { layout: 'lightHorizontalLines' }; // optional
            let header = item.columns.map(col => { 
                return { text: col.tag.label || col.tag.name, bold: true, style: [{ alignment: col.align }] }
            });
            //item.columns.map(col => col.tag.address || '');
            let values = [];
            let tagsids = item.columns.filter(col => col.type !== 0).map(col => col.tag.id);
            let fncs = item.columns.filter(col => col.type !== 0).map(col => col.function);
            let timeRange = _getDateRange(item.range);
            let options = { interval: item.interval, functions: fncs };
            await runtime.daqStorage.getNodesValues(tagsids, timeRange.begin.getTime(), timeRange.end.getTime(), options).then(result => {
                values = result;
            }).catch(function (err) {
                values = item.columns.map(col => 'ERROR');
            });
            content['table'] = {
                // headers are automatically repeated if the table spans over multiple pages
                // you can declare how many rows should be treated as headers
                headerRows: 1,
                widths: item.columns.map(col => col.width), //[ '*', 'auto', 100],
                body: [
                    header,
                    ...values
                ]
            }
            resolve(content);
        });
    }

    
    var _getDateRange = function (dateRange) {
        if (dateRange === ReportDateRangeType.day) {
            var yesterday = new Date(currentTime);
            yesterday.setDate(yesterday.getDate() - 1);
            return { 
                begin: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()), 
                end: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59)
            };
        } else if (dateRange === ReportDateRangeType.week) {
            var lastWeek = new Date(currentTime);
            lastWeek = new Date(lastWeek.setDate(lastWeek.getDate() - 7 - (lastWeek.getDay() + 6 ) % 7));
            var diff = lastWeek.getDate() - lastWeek.getDay() + (lastWeek.getDay() == 0 ? -6 : 1); // adjust when day is sunday
            lastWeek = new Date(lastWeek.setDate(diff));
            return { 
                begin: new Date(lastWeek.getFullYear(), lastWeek.getMonth(), lastWeek.getDate()), 
                end: new Date(lastWeek.getFullYear(), lastWeek.getMonth(), lastWeek.getDate() + 6, 23, 59, 59)
            };
        } else if (dateRange === ReportDateRangeType.month) {
            var lastMonth = new Date(currentTime);
            lastMonth.setMonth(lastMonth.getMonth() - 1);
            lastMonth.setDate(-1);
            return { 
                begin: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1), 
                end: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), lastMonth.getDate(), 23, 59, 59)
            };
        } else {
            return { 
                begin: new Date(currentTime), 
                end: new Date(currentTime)
            };
        }
    }
}

function inTimeToExecute(hour) {
    return (hour >= 2 && hour <= 3);
}

const ReportSchedulingType = {
    none: 'none',
    day: 'day',
    week: 'week',
    month: 'month',
}

const ReportDateRangeType = {
    none: 'none',
    day: 'day',
    week: 'week',
    month: 'month',
}

module.exports = {
    create: function (property, runtime) {
        return new Report(property, runtime);
    },
    ReportSchedulingType: ReportSchedulingType
}