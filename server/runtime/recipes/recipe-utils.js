/**
 * Shared helpers for recipe type/instance composition.
 */

'use strict';

function mergeInstanceWithTemplate(runtime, data) {
    if (!data || !data.typeId) {
        return data;
    }

    var template = runtime && runtime.project && runtime.project.getRecipe ? runtime.project.getRecipe(data.typeId) : null;
    if (!template || !Array.isArray(template.entries)) {
        return data;
    }

    var valuesByTagId = new Map();
    (Array.isArray(data.entries) ? data.entries : []).forEach(entry => {
        if (entry && entry.tagId) {
            valuesByTagId.set(entry.tagId, entry);
        }
    });

    return {
        ...data,
        entries: template.entries.map(templateEntry => {
            var storedEntry = valuesByTagId.get(templateEntry.tagId);
            return {
                ...templateEntry,
                value: storedEntry && storedEntry.value !== undefined ? storedEntry.value : templateEntry.value
            };
        })
    };
}

function getRecipeTypes(runtime) {
    var recipes = runtime && runtime.project && runtime.project.getRecipesSync ? runtime.project.getRecipesSync() : [];
    return (recipes || []).map(recipe => ({ id: recipe.id, data: recipe })).sort(sortByName);
}

function sortByName(a, b) {
    var nameA = (a.data && a.data.name ? String(a.data.name) : '').toLowerCase();
    var nameB = (b.data && b.data.name ? String(b.data.name) : '').toLowerCase();
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
}

// Device tag types that behave like one of the recipe type families
var TAG_TYPE_FAMILIES = {
    sint: 'int', usint: 'int', uint: 'int', udint: 'int', lint: 'int', ulint: 'int', sbyte: 'int',
    uint16: 'int', uint32: 'int', int64: 'int', uint64: 'int',
    float32: 'real', float64: 'real'
};

/**
 * Normalize a device tag type (Modbus UInt16, Float32MLE, OPC UA UInt32, ...)
 * to the lower-case recipe type used for validation and value coercion.
 * @param {string} tagType
 * @returns {string}
 */
function normalizeTagType(tagType) {
    var type = (tagType || '').toLowerCase();
    // Modbus byte/word order variants (Int16LE, UInt32MLE, Float64MLE, ...)
    var ordered = /^(u?int\d+|float\d+)m?le$/.exec(type);
    if (ordered) {
        type = ordered[1];
    }
    return TAG_TYPE_FAMILIES[type] || type;
}

module.exports = {
    normalizeTagType: normalizeTagType,
    mergeInstanceWithTemplate: mergeInstanceWithTemplate,
    getRecipeTypes: getRecipeTypes,
    sortByName: sortByName
};
