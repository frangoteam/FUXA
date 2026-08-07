/**
 * Module to manage recipe data storage
 */

'use strict';

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

var settings;
var logger;
var runtime;
var recipeDB;

var TABLE_RECIPES = 'recipes';

function init(_settings, _log, _runtime) {
    settings = _settings;
    logger = _log;
    runtime = _runtime;
    
    return new Promise((resolve, reject) => {
        try {
            _createDB().then(() => {
                resolve();
            }).catch(err => {
                logger.error('recipe-storage init error: ' + err);
                reject(err);
            });
        } catch (err) {
            logger.error('recipe-storage init error: ' + err);
            reject(err);
        }
    });
}

function _createDB() {
    return new Promise((resolve, reject) => {
        const dbPath = path.join(settings.workDir, 'recipes.db');
        recipeDB = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                logger.error('recipe-storage DB connection error: ' + err);
                reject(err);
            } else {
                // Create the recipes table if it doesn't exist
                const createTableSQL = `
                    CREATE TABLE IF NOT EXISTS ${TABLE_RECIPES} (
                        id TEXT PRIMARY KEY,
                        data TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `;
                
                recipeDB.run(createTableSQL, (err) => {
                    if (err) {
                        logger.error('recipe-storage table creation error: ' + err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            }
        });
    });
}

function getRecipeData(recipeId) {
    return new Promise((resolve, reject) => {
        if (!recipeDB) {
            reject(new Error('Recipe database not initialized'));
            return;
        }
        
        const sql = `SELECT data FROM ${TABLE_RECIPES} WHERE id = ?`;
        recipeDB.get(sql, [recipeId], (err, row) => {
            if (err) {
                logger.error('recipe-storage get error: ' + err);
                reject(err);
            } else if (row) {
                try {
                    const data = JSON.parse(row.data);
                    resolve(data);
                } catch (parseErr) {
                    logger.error('recipe-storage JSON parse error: ' + parseErr);
                    reject(parseErr);
                }
            } else {
                resolve(null);
            }
        });
    });
}

function setRecipeData(recipeId, data) {
    return new Promise((resolve, reject) => {
        if (!recipeDB) {
            reject(new Error('Recipe database not initialized'));
            return;
        }
        
        const jsonData = JSON.stringify(data);
        const sql = `
            INSERT OR REPLACE INTO ${TABLE_RECIPES} (id, data, updated_at) 
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `;
        
        recipeDB.run(sql, [recipeId, jsonData], function(err) {
            if (err) {
                logger.error('recipe-storage set error: ' + err);
                reject(err);
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
}

function getAllRecipes() {
    return new Promise((resolve, reject) => {
        if (!recipeDB) {
            reject(new Error('Recipe database not initialized'));
            return;
        }
        
        const sql = `SELECT id, data FROM ${TABLE_RECIPES}`;
        recipeDB.all(sql, [], (err, rows) => {
            if (err) {
                logger.error('recipe-storage get all error: ' + err);
                reject(err);
            } else {
                try {
                    const recipes = rows.map(row => ({
                        id: row.id,
                        data: JSON.parse(row.data)
                    }));
                    _sortByName(recipes);
                    resolve(recipes);
                } catch (parseErr) {
                    logger.error('recipe-storage JSON parse error: ' + parseErr);
                    reject(parseErr);
                }
            }
        });
    });
}

/**
 * Get all recipe types (recipes without typeId).
 * @returns {Promise<Array>} Array of { id, data } objects
 */
function getRecipeTypes() {
    return new Promise((resolve, reject) => {
        if (!recipeDB) {
            reject(new Error('Recipe database not initialized'));
            return;
        }

        const sql = `SELECT id, data FROM ${TABLE_RECIPES}`;
        recipeDB.all(sql, [], (err, rows) => {
            if (err) {
                logger.error('recipe-storage get types error: ' + err);
                reject(err);
            } else {
                try {
                    const recipes = rows.filter(row => {
                        try {
                            const d = JSON.parse(row.data);
                            return !d.typeId;
                        } catch {
                            return true; // if parse fails, treat as type
                        }
                    }).map(row => ({
                        id: row.id,
                        data: JSON.parse(row.data)
                    }));
                    _sortByName(recipes);
                    resolve(recipes);
                } catch (parseErr) {
                    logger.error('recipe-storage get types JSON error: ' + parseErr);
                    reject(parseErr);
                }
            }
        });
    });
}

/**
 * Get all recipe instances for a given type.
 * @param {string} typeId - The recipe type id to filter by
 * @returns {Promise<Array>} Array of { id, data } objects
 */
function getAllRecipesByType(typeId) {
    return new Promise((resolve, reject) => {
        if (!recipeDB) {
            reject(new Error('Recipe database not initialized'));
            return;
        }

        const sql = `SELECT id, data FROM ${TABLE_RECIPES}`;
        recipeDB.all(sql, [], (err, rows) => {
            if (err) {
                logger.error('recipe-storage get by type error: ' + err);
                reject(err);
            } else {
                try {
                    const recipes = rows.filter(row => {
                        try {
                            const d = JSON.parse(row.data);
                            return d.typeId === typeId;
                        } catch {
                            return false; // if parse fails, exclude
                        }
                    }).map(row => ({
                        id: row.id,
                        data: JSON.parse(row.data)
                    }));
                    _sortByName(recipes);
                    resolve(recipes);
                } catch (parseErr) {
                    logger.error('recipe-storage get by type JSON error: ' + parseErr);
                    reject(parseErr);
                }
            }
        });
    });
}

function deleteRecipeData(recipeId) {
    return new Promise((resolve, reject) => {
        if (!recipeDB) {
            reject(new Error('Recipe database not initialized'));
            return;
        }
        
        const sql = `DELETE FROM ${TABLE_RECIPES} WHERE id = ?`;
        recipeDB.run(sql, [recipeId], function(err) {
            if (err) {
                logger.error('recipe-storage delete error: ' + err);
                reject(err);
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
}

/**
 * Sort recipe rows by name (case-insensitive) for a stable, predictable order.
 * Recipes without a name sort last.
 * @param {Array<{id: string, data: Object}>} recipes - Array in place
 */
function _sortByName(recipes) {
    recipes.sort(function(a, b) {
        var nameA = (a.data && a.data.name ? String(a.data.name) : '').toLowerCase();
        var nameB = (b.data && b.data.name ? String(b.data.name) : '').toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
    });
}

function close() {
    if (recipeDB) {
        recipeDB.close((err) => {
            if (err) {
                logger.error('recipe-storage close error: ' + err);
            }
        });
    }
}

module.exports = {
    init: init,
    getRecipeData: getRecipeData,
    setRecipeData: setRecipeData,
    getAllRecipes: getAllRecipes,
    getRecipeTypes: getRecipeTypes,
    getAllRecipesByType: getAllRecipesByType,
    deleteRecipeData: deleteRecipeData,
    close: close
};
