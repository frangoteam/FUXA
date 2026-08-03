/**
 * Recipe service — business logic for recipe download/upload with type coercion.
 */

'use strict';

const Events = require('../events');

var settings;
var logger;
var runtime;
const runningRecipes = new Set();

/**
 * Initialize the recipe service with runtime dependencies.
 * @param {Object} _settings - Runtime settings
 * @param {Object} _log - Logger instance
 * @param {Object} _runtime - Runtime object (provides devices, io, recipeStorage)
 * @returns {Object} Public API surface
 */
function init(_settings, _log, _runtime) {
    settings = _settings;
    logger = _log;
    runtime = _runtime;
    return {
        downloadRecipe: downloadRecipe,
        uploadRecipe: uploadRecipe,
        cancelRecipe: cancelRecipe,
        isRecipeRunning: isRecipeRunning
    };
}

/**
 * Coerce a value to the correct JavaScript type based on tagType.
 * Pure function — no dependencies on runtime state.
 * @param {*} value - The value to coerce
 * @param {string} tagType - The tag type (case-insensitive)
 * @returns {*} Coerced value, or original if coercion not possible
 */
function coerceValue(value, tagType) {
    // Null/undefined pass through unchanged
    if (value === null || value === undefined) {
        return value;
    }

    var type = (tagType || '').toLowerCase();

    // Boolean family
    if (type === 'bool' || type === 'boolean') {
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'string') {
            var lower = value.toLowerCase();
            if (lower === 'true' || lower === '1') {
                return true;
            }
            if (lower === 'false' || lower === '0') {
                return false;
            }
        }
        return value;
    }

    // Integer family
    if (type === 'int' || type === 'dint' || type === 'int16' || type === 'int32' || type === 'number') {
        if (typeof value === 'number') {
            return value;
        }
        var intVal = parseInt(value, 10);
        if (isNaN(intVal)) {
            return value;
        }
        return intVal;
    }

    // Float/Real family
    if (type === 'real' || type === 'float' || type === 'double') {
        if (typeof value === 'number') {
            return value;
        }
        var floatVal = parseFloat(value);
        if (isNaN(floatVal)) {
            return value;
        }
        return floatVal;
    }

    // Byte type (clamped 0-255)
    if (type === 'byte') {
        if (typeof value === 'number' && Number.isInteger(value)) {
            return Math.max(0, Math.min(255, value));
        }
        var byteVal = parseInt(value, 10);
        if (isNaN(byteVal)) {
            return value;
        }
        return Math.max(0, Math.min(255, byteVal));
    }

    // String/Word — pass through unchanged
    if (type === 'string' || type === 'word') {
        return value;
    }

    // Unknown/empty tagType — pass through unchanged
    return value;
}

/**
 * Emit a progress event via Socket.IO for a single entry.
 * @param {string} eventType - The IoEventType constant
 * @param {Object} payload - Event payload
 */
function _emitProgress(eventType, payload) {
    if (runtime && runtime.io) {
        runtime.io.emit(eventType, payload);
    }
}

/**
 * Download a recipe — push tag values to devices.
 * @param {string} recipeId - Recipe ID
 * @returns {Promise<void>}
 */
async function downloadRecipe(recipeId) {
    if (runningRecipes.has(recipeId)) {
        throw new Error('Recipe execution already in progress');
    }

    runningRecipes.add(recipeId);

    try {
        var data = await runtime.recipeStorage.getRecipeData(recipeId);
        if (!data) {
            throw new Error('Recipe not found');
        }

        var entries = data.entries || [];
        var successCount = 0;
        var errorCount = 0;
        var errors = [];
        var total = entries.length;

        for (var i = 0; i < entries.length; i++) {
            if (!runningRecipes.has(recipeId)) {
                _emitProgress(Events.IoEventTypes.RECIPE_CANCELED, { recipeId });
                break;
            }

            var entry = entries[i];

            // Emit writing progress
            _emitProgress(Events.IoEventTypes.RECIPE_DOWNLOAD_PROGRESS, {
                recipeId: recipeId,
                entryId: entry.id,
                tagId: entry.tagId,
                tagName: entry.tagName,
                index: i,
                total: total,
                status: 'writing'
            });

            try {
                var coerced = coerceValue(entry.value, entry.tagType);
                var result = await runtime.devices.setTagValue(entry.tagId, coerced);
                if (result === null || result === undefined || result === false) {
                    throw new Error('Write failed for tag ' + (entry.tagName || entry.tagId));
                }

                _emitProgress(Events.IoEventTypes.RECIPE_DOWNLOAD_PROGRESS, {
                    recipeId: recipeId,
                    entryId: entry.id,
                    tagId: entry.tagId,
                    tagName: entry.tagName,
                    index: i,
                    total: total,
                    status: 'success',
                    value: coerced
                });

                successCount++;
            } catch (err) {
                _emitProgress(Events.IoEventTypes.RECIPE_DOWNLOAD_PROGRESS, {
                    recipeId: recipeId,
                    entryId: entry.id,
                    tagId: entry.tagId,
                    tagName: entry.tagName,
                    index: i,
                    total: total,
                    status: 'error',
                    error: err.message
                });

                errors.push({
                    entryId: entry.id,
                    tagId: entry.tagId,
                    error: err.message
                });
                errorCount++;
            }
        }

        _emitProgress(Events.IoEventTypes.RECIPE_DOWNLOAD_COMPLETE, {
            recipeId: recipeId,
            successCount: successCount,
            errorCount: errorCount,
            errors: errors
        });
    } catch (err) {
        _emitProgress(Events.IoEventTypes.RECIPE_DOWNLOAD_ERROR, {
            recipeId: recipeId,
            error: err.message
        });
        throw err;
    } finally {
        runningRecipes.delete(recipeId);
    }
}

/**
 * Upload a recipe — pull tag values from devices and persist.
 * @param {string} recipeId - Recipe ID
 * @returns {Promise<void>}
 */
async function uploadRecipe(recipeId) {
    if (runningRecipes.has(recipeId)) {
        throw new Error('Recipe execution already in progress');
    }

    runningRecipes.add(recipeId);

    try {
        var data = await runtime.recipeStorage.getRecipeData(recipeId);
        if (!data) {
            throw new Error('Recipe not found');
        }

        var updatedData = JSON.parse(JSON.stringify(data));
        var entries = updatedData.entries || [];
        var successCount = 0;
        var errorCount = 0;
        var errors = [];
        var total = entries.length;

        for (var i = 0; i < entries.length; i++) {
            if (!runningRecipes.has(recipeId)) {
                _emitProgress(Events.IoEventTypes.RECIPE_CANCELED, { recipeId });
                break;
            }

            var entry = entries[i];

            // Emit reading progress
            _emitProgress(Events.IoEventTypes.RECIPE_UPLOAD_PROGRESS, {
                recipeId: recipeId,
                entryId: entry.id,
                tagId: entry.tagId,
                tagName: entry.tagName,
                index: i,
                total: total,
                status: 'reading'
            });

            try {
                var value = await runtime.devices.getTagValue(entry.tagId);
                if (value === null || value === undefined || value === false) {
                    throw new Error('Read failed for tag ' + (entry.tagName || entry.tagId));
                }
                entry.value = value;

                _emitProgress(Events.IoEventTypes.RECIPE_UPLOAD_PROGRESS, {
                    recipeId: recipeId,
                    entryId: entry.id,
                    tagId: entry.tagId,
                    tagName: entry.tagName,
                    index: i,
                    total: total,
                    status: 'success',
                    value: value
                });

                successCount++;
            } catch (err) {
                _emitProgress(Events.IoEventTypes.RECIPE_UPLOAD_PROGRESS, {
                    recipeId: recipeId,
                    entryId: entry.id,
                    tagId: entry.tagId,
                    tagName: entry.tagName,
                    index: i,
                    total: total,
                    status: 'error',
                    error: err.message
                });

                errors.push({
                    entryId: entry.id,
                    tagId: entry.tagId,
                    error: err.message
                });
                errorCount++;
            }
        }

        // Persist only if at least one entry succeeded
        if (successCount > 0) {
            await runtime.recipeStorage.setRecipeData(recipeId, updatedData);
        }

        _emitProgress(Events.IoEventTypes.RECIPE_UPLOAD_COMPLETE, {
            recipeId: recipeId,
            successCount: successCount,
            errorCount: errorCount,
            errors: errors
        });
    } catch (err) {
        _emitProgress(Events.IoEventTypes.RECIPE_UPLOAD_ERROR, {
            recipeId: recipeId,
            error: err.message
        });
        throw err;
    } finally {
        runningRecipes.delete(recipeId);
    }
}

/**
 * Cancel a recipe execution by removing it from the running set.
 * @param {string} recipeId - Recipe ID
 */
function cancelRecipe(recipeId) {
    runningRecipes.delete(recipeId);
}

/**
 * Check if a recipe is currently running.
 * @param {string} recipeId - Recipe ID
 * @returns {boolean}
 */
function isRecipeRunning(recipeId) {
    return runningRecipes.has(recipeId);
}

module.exports = {
    init: init,
    coerceValue: coerceValue,
    downloadRecipe: downloadRecipe,
    uploadRecipe: uploadRecipe,
    cancelRecipe: cancelRecipe,
    isRecipeRunning: isRecipeRunning
};
