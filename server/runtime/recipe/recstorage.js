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
        var sql = "CREATE TABLE IF not exists recipes(recipeId INTEGER NOT NULL,recipeName TEXT NOT NULL,description INTEGER,creationTime INTEGER NOT NULL,lastModifiedTime INTEGER NOT NULL,dbBlockAddress TEXT, version TEXT,isActive INTEGER NOT NULL,detail TEXT NOT NULL,PRIMARY KEY(recipeId AUTOINCREMENT));";
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
        // 注意: 我们不再手动为recipeId提供值，SQLite会自动处理
        var sql = `
            INSERT INTO recipes (
                recipeName, description, creationTime, lastModifiedTime, dbBlockAddress, version, isActive, detail
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
        `;
        var value =  JSON.stringify(recipe.detail).replace(/\'/g,"''")
        var params = [
            recipe.recipeName,
            recipe.description,
            recipe.creationTime,
            recipe.lastModifiedTime,
            recipe.dbBlockAddress,
            recipe.version,
            recipe.isActive,
            value
        ];

        db_recipes.run(sql, params, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);  // 返回新创建的recipe的ID
            }
        });
    });
}


function getRecipes(){
    return new Promise(function (resolve, reject) {
        var sql = `SELECT recipeId, recipeName, description, creationTime, lastModifiedTime, dbBlockAddress, version, isActive, detail
                   FROM recipes `;
        db_recipes.all(sql, function (err, rows) {
            if (err) {
                reject(err);
            } else {
                console.log("test")
                const recipesWithArrayDetail = rows.map(row => {
                    return {
                        ...row,
                        detail: JSON.parse(row.detail)
                    };
                });
                resolve(recipesWithArrayDetail);
            }
        });
    });
}


function updateRecipe(query) {
    return new Promise(function (resolve, reject) {


        // 初始化SQL片段和参数数组
        let sqlFragments = [];
        let params = [];

        // 遍历query对象，对于每个存在的属性，添加到SQL片段和参数数组中
        for (let key in query) {
            // 排除recipeId，因为它用于WHERE子句
            if (query.hasOwnProperty(key) && key !== 'recipeId' && query[key] !== undefined) {
                if (key === 'detail') {
                    // 对于 detail 属性，将其转换为 JSON 字符串并转义单引号
                    params.push(JSON.stringify(query[key]).replace(/'/g, "''"));
                } else {
                    params.push(query[key]);
                }
                sqlFragments.push(`${key} = ?`);
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
    getRecipes: getRecipes,
    updateRecipe:updateRecipe,
    removeRecipe : removeRecipe
};