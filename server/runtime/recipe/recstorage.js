'use strict';

const fs = require('fs');
const path = require('path');
var sqlite3 = require('sqlite3').verbose();

var settings        // Application settings
var logger;         // Application logger
var db_recipes;      // Database of recipes

/**
 * Init and bind the database resource
 * @param {*} _settings
 * @param {*} _log
 */
function init(_settings, _log) {
    settings = _settings;
    logger = _log;

    return _bind();
}

function _bind(){
    return new Promise(function (resolve, reject) {
        var dbfile = path.join(settings.workDir, 'recipes.fuxap.db');
        var dbfileExist = fs.existsSync(dbfile);

        db_recipes = new sqlite3.Database(dbfile, function (err) {
            if (err) {
                logger.error('recipesstorage.failed-to-bind: ' + err);
                reject();
            }
            logger.info('recipesstorage.connected-to ' + dbfile + ' database.', true);
        });
        // prepare query
        var sql = "CREATE TABLE if not exists recipes (recipeId INTEGER PRIMARY KEY AUTOINCREMENT PRIMARY KEY NOT NULL, recipeName TEXT NOT NULL, description TEXT, creationTime INTEGER NOT NULL, lastModifiedTime INTEGER NOT NULL, version TEXT, isActive BOOLEAN DEFAULT FALSE, detail TEXT);";
        db_recipes.exec(sql, function (err) {
            if (err) {
                logger.error('recipesstorage.failed-to-bind: ' + err);
                reject();
            } else {
                resolve(dbfileExist);
            }
        });
    });
}

function addRecipe(recipe) {
    return new Promise((resolve, reject) => {
        logger.info(recipe);
        // // 注意: 我们不再手动为recipeId提供值，SQLite会自动处理
        // var sql = `
        //     INSERT INTO recipes (
        //         recipeName, description, creationTime, lastModifiedTime, version, isActive, detail
        //     ) VALUES (?, ?, ?, ?, ?, ?, ?);
        // `;
        //
        // var params = [
        //     recipe.recipeName,
        //     recipe.description,
        //     recipe.creationTime,
        //     recipe.lastModifiedTime,
        //     recipe.version,
        //     recipe.isActive,
        //     recipe.detail
        // ];
        //
        // db_recipes.run(sql, params, function(err) {
        //     if (err) {
        //         reject(err);
        //     } else {
        //         resolve(this.lastID);  // 返回新创建的recipe的ID
        //     }
        // });
    });
}


function pageRecipes(pageNumber = 1, pageSize = 10){
    return new Promise(function (resolve, reject) {
        const offset = (pageNumber - 1) * pageSize;
        var sql = `SELECT recipeId, recipeName, description, creationTime, lastModifiedTime, version, isActive
                   FROM recipes LIMIT ? OFFSET ?`;
        db_recipes.all(sql, [pageSize, offset], function (err, rows) {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}


function updateRecipe(query) {
    return new Promise(function (resolve, reject) {
        // 检查 query 是否包含必要的标识信息
        if (!query.recipeId) {
            reject(new Error('Recipe ID is required for update.'));
            return;
        }

        // 初始化SQL片段和参数数组
        let sqlFragments = [];
        let params = [];

        // 遍历query对象，对于每个存在的属性，添加到SQL片段和参数数组中
        for (let key in query) {
            if (query.hasOwnProperty(key) && query[key] !== undefined) {
                if (key !== 'recipeId') {  // 排除recipeId，因为它用于WHERE子句
                    sqlFragments.push(`${key} = ?`);
                    params.push(query[key]);
                }
            }
        }

        if (sqlFragments.length === 0) {
            reject(new Error('No fields provided for update.'));
            return;
        }

        // 组装完整的SQL语句
        let sql = `UPDATE recipes SET ${sqlFragments.join(', ')} WHERE recipeId = ?`;
        params.push(query.recipeId); // 添加recipeId到参数列表的末尾，用于WHERE子句

        // 执行更新
        db_recipes.run(sql, params, function (err) {
            if (err) {
                logger.error(`Update recipe failed! ${err}`);
                reject(err);
            } else {
                resolve();
            }
        });
    });
}



function removeRecipe(recipeId) {
    return new Promise((resolve, reject) => {
        var sql = `DELETE FROM recipes WHERE recipeId = ?`;

        db_recipes.run(sql, [recipeId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}


function close(){
    if(db_recipes){
        db_recipes.close();
    }
}

module.exports = {
    init: init,
    close: close,
    addRecipe: addRecipe,
    pageRecipes:pageRecipes,
    updateRecipe:updateRecipe,
    removeRecipe : removeRecipe
};