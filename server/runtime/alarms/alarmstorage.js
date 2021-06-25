/**
 *  Module to manage the alarms in a database
 *  Table: 'alarms', 'history'
 */

 'use strict';

 const fs = require('fs');
 const path = require('path');
 var sqlite3 = require('sqlite3').verbose();
 
 var settings        // Application settings
 var logger;         // Application logger
 var db_alarms;      // Database of alarms
 var db_history;     // Database of alarm history
 
 /**
  * Init and bind the database resource
  * @param {*} _settings 
  * @param {*} _log 
  */
 function init(_settings, _log) {
     settings = _settings;
     logger = _log;
     
     return _bindHistory();	
 }
 
 /**
  * Bind the database resource by create the table if not exist
  */
 function _bind() {
     return new Promise(function (resolve, reject) {
         var dbfile = path.join(settings.workDir, 'alarms.fuxap.db');
         var dbfileExist = fs.existsSync(dbfile);
         
         db_alarms = new sqlite3.Database(dbfile, function (err) {
             if (err) {
                 logger.error('alarmsstorage.failed-to-bind: ' + err);
                 reject();
             }
             logger.info('alarmsstorage.connected-to ' + dbfile + ' database.', true);
         });
         // prepare query
         var sql = "CREATE TABLE if not exists alarms (nametype TEXT PRIMARY KEY, type TEXT, status TEXT, ontime INTEGER, offtime INTEGER, acktime INTEGER);";
         // sql += "CREATE TABLE if not exists history (dt INTEGER, name TEXT, type TEXT, text TEXT, groups TEXT, status INTEGER);";
         db_alarms.exec(sql, function (err) {
             if (err) {
                 logger.error('alarmsstorage.failed-to-bind: ' + err);
                 reject();
             } else {
                 resolve(dbfileExist);
             }
         });
     });
 }
 
 /**
  * Bind the alarm history database resource by create the table if not exist
  */
 
 function _bindHistory() {
     return new Promise(function (resolve, reject) {
         //Log record file - Alp
         var historyfile = path.join(settings.workDir, 'history.fuxap.db');
         var historyfileExist = fs.existsSync(historyfile);
         
         var isBinded=_bind();
         isBinded.finally((result) => { 
                 //check connection to event db
                 db_history = new sqlite3.Database(historyfile, function (err) {
                     if (err) {
                         logger.error('alarm-history_storage.failed-to-bind: ' + err); //change text
                         reject();
                     }
                     logger.info('alarm-history_storage.connected-to ' + historyfile + ' database.', true); //change text
                 });
                 
                 // prepare query
                 var sqlCreate = "CREATE TABLE if not exists history (nametype TEXT PRIMARY KEY, type TEXT, laststatus TEXT, alarmtext TEXT, ontime INTEGER, useron TEXT, offtime INTEGER, useroff TEXT,  acktime INTEGER, userack TEXT);";
                 db_history.exec(sqlCreate, function (err) {
                     if (err) {
                         logger.error('alarm-history_storage.failed-to-bind: ' + err); //change text
                         reject();
                     } else {
                         resolve(historyfileExist);
                     }
                 });
           },
           (error) => { 
                   logger.error('alarmsstorage.failed-to-bind: ' + err);
           }
         );		
     });
         
 }
 
 /**
  * Clear all Alarms from table
  */
 function clearAlarms() {
     return new Promise(function (resolve, reject) {
         var sql = "DELETE FROM alarms";
         db_alarms.all(sql, function (err, rows) {
             if (err) {
                 reject(err);
             } else {
                 resolve(rows);
             }
         });
     });
 }
 
 /**
  * Return the Alarms list
  */
 function getAlarms() {
     return new Promise(function (resolve, reject) {
         var sql = "SELECT * FROM alarms";
         db_alarms.all(sql, function (err, rows) {
             if (err) {
                 reject(err);
             } else {
                 resolve(rows);
             }
         });   
     });
 }
 
 /**
  * Set alarm value in database
  */
 function setAlarms(alarms) {
     return new Promise(function (resolve, reject) {
         // prepare query
         if (alarms && alarms.length) {
             var sql = "";
             alarms.forEach(alr => {
                     //is alarm condition is changed (if it is occured or acknowledged) insert or update record
                     sql += "INSERT OR REPLACE INTO alarms (nametype, type, status, ontime, offtime, acktime) VALUES('" + 
                             alr.getId() + "','"+ alr.type + "','"+ alr.status + "','"+ alr.ontime + "','"+ alr.offtime + "','" + alr.acktime + "');" +
                             "INSERT OR REPLACE INTO history (Sn, nametype, type, laststatus, alarmtext, ontime, useron, offtime, useroff,  acktime, userack)" +
                             " VALUES ((SELECT Sn from history WHERE ontime='" + alr.ontime + "'),'" +
                             alr.getId() + "','"+ alr.type + "','" + alr.status + "','" + alr.subproperty.text + "','" + alr.ontime + "','" + "usr" + "','" + alr.offtime + "','" + "usr" + "','" + alr.acktime + "','" + "usr"+ "');";
                 if (alr.toremove) {
                     //is alarm to be removed (if it is ok) delete it from db
                     sql += "DELETE FROM alarms WHERE nametype = '" + alr.getId() + "';";                 
				 }
             });
             db_alarms.exec(sql, function (err) {
                 if (err) {
                     logger.error('alarmsstorage.failed-to-set: ' + err);
                     reject();
                 } else {
                     resolve();
                 }
             });						
         }
     });
 }
 
 /**
  * Set alarm history in database
  */
 function setHistory(alarms) {
     return new Promise(function (resolve, reject) {
         // prepare query
         if (alarms && alarms.length) {
             var sqlHistory = "";		
             alarms.forEach(alr => {
                     sqlHistory = "INSERT OR REPLACE INTO history (nametype, type, status, ontime, useron, offtime, useroff,  acktime, userack) VALUES('" + 
                             alr.getId() + "','"+ alr.type + "','" + alr.status + "','" + alr.ontime + "','" + "usr" + "','" + alr.offtime + "','" + "usr" + "','" + alr.acktime + "','" + "usr" + "');";                      
             });
             //save history
             db_history.exec(sqlHistory, function (err) {
                 if (err) {
                     logger.error('alarm-history_storage.failed-to-set: ' + err);
                     reject();
                 } else {
                     resolve();
                 }
             });
         }		
     });
 }
 
 /**
  * Remove alarm from database
  */
 function removeAlarm(alarm) {
     return new Promise(function (resolve, reject) {
         // prepare query
         var sql = "DELETE FROM users WHERE username = '" + usr + "'";
         db_alarms.exec(sql, function (err) {
             if (err) {
                 logger.error('usrstorage.failed-to-remove: ' + err);
                 reject();
             } else {
                 resolve();
             }
         });     
     });
 }
 
 /**
  * Close the database
  */
 function close() {
     if (db_alarms) {
         db_alarms.close();
     }
     if (db_history) {
         db_history.close();            //history.db
     }    
 }
 
 module.exports = {
     init: init,
     close: close,
     getAlarms: getAlarms,
     setAlarms: setAlarms,
     clearAlarms: clearAlarms,
     removeAlarm: removeAlarm,
	 setHistory: setHistory
 };
