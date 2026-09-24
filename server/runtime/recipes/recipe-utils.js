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

module.exports = {
    mergeInstanceWithTemplate: mergeInstanceWithTemplate,
    getRecipeTypes: getRecipeTypes,
    sortByName: sortByName
};
