/**
 * 'api/recipes': Recipes API to GET/POST recipe data, download/upload, import/export
 */

var express = require("express");
const authJwt = require('../jwt-helper');
const crypto = require('crypto');

var runtime;
var secureFnc;
var checkGroupsFnc;

const VALID_TAG_TYPES = ['number', 'string', 'boolean', 'bool', 'int', 'dint', 'int16', 'int32', 'real', 'float', 'double', 'byte', 'word'];

module.exports = {
    init: function (_runtime, _secureFnc, _checkGroupsFnc) {
        runtime = _runtime;
        secureFnc = _secureFnc;
        checkGroupsFnc = _checkGroupsFnc;
    },
    app: function () {
        var recipesApp = express();
        recipesApp.use(function (req, res, next) {
            if (!runtime.project) {
                res.status(404).end();
            } else {
                // Never cache recipe API responses: Express sends ETags and the
                // browser revalidation returns 304, which Angular's HttpClient
                // treats as an error. no-store forces a fresh 200 every time.
                res.setHeader('Cache-Control', 'no-store');
                next();
            }
        });

        // GET recipe data — list all, get single, get types, or get instances by typeId
        recipesApp.get("/api/recipes/:id?", secureFnc, function(req, res) {
            var idParam = req.params.id;
            var typeId = req.query.typeId;

            if (idParam === 'types') {
                // GET /api/recipes/types — return types only (recipes without typeId)
                _handlePromise(runtime.recipeStorage.getRecipeTypes(), res, function(result) {
                    res.json({ recipes: result || [] });
                }, 'getTypes');
            } else if (typeId) {
                // GET /api/recipes?typeId=xxx — return instances for a given type
                _handlePromise(runtime.recipeStorage.getAllRecipesByType(typeId), res, function(result) {
                    res.json({ recipes: result || [] });
                }, 'getByType');
            } else if (idParam) {
                // GET /api/recipes/:id — get single recipe by id
                _handlePromise(runtime.recipeStorage.getRecipeData(idParam), res, function(result) {
                    if (result) {
                        res.json(result);
                    } else {
                        res.status(404).end();
                    }
                }, 'get');
            } else {
                // GET /api/recipes — return all (backwards compatible)
                _handlePromise(runtime.recipeStorage.getAllRecipes(), res, function(result) {
                    res.json({ recipes: result || [] });
                }, 'getAll');
            }
        });

        // POST recipe data — create or update (upsert)
        recipesApp.post("/api/recipes", secureFnc, function(req, res) {
            if (res.statusCode === 403) {
                runtime.logger.error("api post recipes: Tocken Expired");
                return;
            }
            const permission = checkGroupsFnc(req);
            const isGuest = authJwt.isGuestUser(req.userId, req.userGroups);
            const isAdmin = authJwt.haveAdminPermission(permission);
            if (runtime.settings?.secureEnabled && isGuest) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api post recipes: Unauthorized guest");
                return;
            }
            try {
                var data = req.body;
                if (!data) {
                    res.status(400).json({ error: 'Missing recipe data in request body' });
                    return;
                }

                const validation = _validateRecipeData(data);
                if (!validation.valid) {
                    runtime.logger.error("Invalid recipe data: " + validation.error);
                    res.status(400).json({ error: validation.error });
                    return;
                }

                var id = req.body.id || 'r_' + crypto.randomBytes(6).toString('hex');

                // Generate entry IDs for entries that don't have one
                (data.entries || []).forEach(function(entry) {
                    entry.id = entry.id || 'e_' + crypto.randomBytes(4).toString('hex');
                });

                // Set timestamps
                data.createdAt = data.createdAt || new Date().toISOString();
                data.updatedAt = new Date().toISOString();

                _handlePromise(runtime.recipeStorage.setRecipeData(id, data), res, function() {
                    res.json({ id: id });
                }, 'set');

            } catch (err) {
                runtime.logger.error("api post recipes error: " + err);
                res.status(400).json({ error: err.message });
            }
        });

        // DELETE recipe data
        recipesApp.delete("/api/recipes", secureFnc, function(req, res) {
            if (res.statusCode === 403) {
                runtime.logger.error("api delete recipes: Tocken Expired");
                return;
            }
            const isGuest = authJwt.isGuestUser(req.userId, req.userGroups);
            if (runtime.settings?.secureEnabled && isGuest) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api delete recipes: Unauthorized guest");
                return;
            }
            try {
                if (!req.query || !req.query.id) {
                    res.status(400).json({ error: 'Missing id parameter' });
                    return;
                }
                var id = req.query.id;
                _handlePromise(runtime.recipeStorage.deleteRecipeData(id), res, function(result) {
                    if (result.changes === 0) {
                        res.status(404).json({ error: 'Recipe not found' });
                    } else {
                        res.json({ result: "ok", deleted: result.changes });
                    }
                }, 'delete');

            } catch (err) {
                runtime.logger.error("api delete recipes error: " + err);
                res.status(400).json({ error: err.message });
            }
        });

        // POST download recipe — start async download
        recipesApp.post("/api/recipes/download", secureFnc, function(req, res) {
            if (res.statusCode === 403) {
                runtime.logger.error("api post recipes download: Tocken Expired");
                return;
            }
            const permission = checkGroupsFnc(req);
            const isGuest = authJwt.isGuestUser(req.userId, req.userGroups);
            if (runtime.settings?.secureEnabled && isGuest) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api post recipes download: Unauthorized guest");
                return;
            }
            try {
                if (!req.body || !req.body.id) {
                    res.status(400).json({ error: 'Missing recipe id in request body' });
                    return;
                }
                var id = req.body.id;

                _handlePromise(runtime.recipeStorage.getRecipeData(id), res, function(data) {
                    if (!data) {
                        res.status(400).json({ error: 'Recipe not found' });
                        return;
                    }
                    if (!data.entries || data.entries.length === 0) {
                        res.status(400).json({ error: 'No entries to download' });
                        return;
                    }
                    if (runtime.recipeService.isRecipeRunning(id)) {
                        res.status(400).json({ error: 'Recipe execution already in progress' });
                        return;
                    }

                    // Fire and forget — do NOT await
                    runtime.recipeService.downloadRecipe(id).catch(err => {
                        runtime.logger.error('recipe download failed: ' + err);
                    });

                    res.status(202).json({
                        result: "started",
                        recipeId: id,
                        totalEntries: data.entries.length
                    });
                }, 'get');

            } catch (err) {
                runtime.logger.error("api post recipes download error: " + err);
                res.status(400).json({ error: err.message });
            }
        });

        // POST upload recipe — start async upload
        recipesApp.post("/api/recipes/upload", secureFnc, function(req, res) {
            if (res.statusCode === 403) {
                runtime.logger.error("api post recipes upload: Tocken Expired");
                return;
            }
            const permission = checkGroupsFnc(req);
            const isGuest = authJwt.isGuestUser(req.userId, req.userGroups);
            if (runtime.settings?.secureEnabled && isGuest) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api post recipes upload: Unauthorized guest");
                return;
            }
            try {
                if (!req.body || !req.body.id) {
                    res.status(400).json({ error: 'Missing recipe id in request body' });
                    return;
                }
                var id = req.body.id;

                _handlePromise(runtime.recipeStorage.getRecipeData(id), res, function(data) {
                    if (!data) {
                        res.status(400).json({ error: 'Recipe not found' });
                        return;
                    }
                    if (!data.entries || data.entries.length === 0) {
                        res.status(400).json({ error: 'No entries to upload' });
                        return;
                    }
                    if (runtime.recipeService.isRecipeRunning(id)) {
                        res.status(400).json({ error: 'Recipe execution already in progress' });
                        return;
                    }

                    // Fire and forget — do NOT await
                    runtime.recipeService.uploadRecipe(id).catch(err => {
                        runtime.logger.error('recipe upload failed: ' + err);
                    });

                    res.status(202).json({
                        result: "started",
                        recipeId: id,
                        totalEntries: data.entries.length
                    });
                }, 'get');

            } catch (err) {
                runtime.logger.error("api post recipes upload error: " + err);
                res.status(400).json({ error: err.message });
            }
        });

        // POST export recipe — export as JSON or CSV
        recipesApp.post("/api/recipes/export", secureFnc, function(req, res) {
            try {
                if (!req.body || !req.body.id) {
                    res.status(400).json({ error: 'Missing id in request body' });
                    return;
                }

                _handlePromise(runtime.recipeStorage.getRecipeData(req.body.id), res, function(data) {
                    if (!data) {
                        res.status(404).json({ error: 'Recipe not found' });
                        return;
                    }

                    var format = req.body.format || 'json';
                    if (format === 'json') {
                        res.setHeader('Content-Type', 'application/json');
                        res.setHeader('Content-Disposition', 'attachment; filename="' + data.name + '.json"');
                        res.json(data);
                    } else if (format === 'csv') {
                        var csv = 'tagId,tagName,tagType,value\n';
                        (data.entries || []).forEach(function(entry) {
                            csv += _quoteCSVField(entry.tagId) + ',' +
                                   _quoteCSVField(entry.tagName || '') + ',' +
                                   _quoteCSVField(entry.tagType) + ',' +
                                   _quoteCSVField(entry.value !== undefined ? entry.value : '') + '\n';
                        });
                        res.setHeader('Content-Type', 'text/csv');
                        res.setHeader('Content-Disposition', 'attachment; filename="' + data.name + '.csv"');
                        res.send(csv);
                    } else {
                        res.status(400).json({ error: 'Invalid export format. Use "json" or "csv".' });
                    }
                }, 'get');

            } catch (err) {
                runtime.logger.error("api post recipes export error: " + err);
                res.status(400).json({ error: err.message });
            }
        });

        // POST import recipe — import from JSON or CSV
        recipesApp.post("/api/recipes/import", secureFnc, function(req, res) {
            if (res.statusCode === 403) {
                runtime.logger.error("api post recipes import: Tocken Expired");
                return;
            }
            const permission = checkGroupsFnc(req);
            const isGuest = authJwt.isGuestUser(req.userId, req.userGroups);
            if (runtime.settings?.secureEnabled && isGuest) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api post recipes import: Unauthorized guest");
                return;
            }
            try {
                var content = req.body.file || req.body.data;
                if (!content) {
                    res.status(400).json({ error: 'Missing file or data in request body' });
                    return;
                }

                var format = req.body.format;
                if (!format) {
                    var trimmed = (typeof content === 'string') ? content.trim() : '';
                    format = (trimmed.startsWith('{') || trimmed.startsWith('[')) ? 'json' : 'csv';
                }

                var resultPromise;
                if (format === 'json') {
                    resultPromise = _importJson(content, req.body.name, req.body.description);
                } else if (format === 'csv') {
                    resultPromise = _importCsv(content, req.body.name, req.body.description);
                } else {
                    res.status(400).json({ error: 'Invalid format. Use "json" or "csv".' });
                    return;
                }

                resultPromise.then(function(result) {
                    res.json(result);
                }).catch(function(err) {
                    runtime.logger.error('recipe-storage import error: ' + err);
                    res.status(400).json({ error: err.message });
                });

            } catch (err) {
                runtime.logger.error("api post recipes import error: " + err);
                res.status(400).json({ error: err.message });
            }
        });

        return recipesApp;
    }
};

// ─── Validation ───────────────────────────────────────────────────────────────

function _validateRecipeData(data) {
    if (!data || typeof data !== 'object') {
        return { valid: false, error: 'Invalid recipe data: Data must be an object' };
    }

    // name — required, non-empty string, max 128 chars
    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
        return { valid: false, error: 'Invalid recipe data: name is required and must be a non-empty string' };
    }

    if (data.name.length > 128) {
        return { valid: false, error: 'Invalid recipe data: name must not exceed 128 characters' };
    }

    // description — optional, max 512 chars
    if (data.description && typeof data.description === 'string' && data.description.length > 512) {
        return { valid: false, error: 'Invalid recipe data: description must not exceed 512 characters' };
    }

    // entries — required, array, min 1, max 1000
    if (!data.entries || !Array.isArray(data.entries)) {
        return { valid: false, error: 'Invalid recipe data: entries must be an array' };
    }

    if (data.entries.length < 1) {
        return { valid: false, error: 'Invalid recipe data: at least one entry is required' };
    }

    if (data.entries.length > 1000) {
        return { valid: false, error: 'Invalid recipe data: maximum 1000 entries allowed' };
    }

    // Validate each entry
    for (var i = 0; i < data.entries.length; i++) {
        var entry = data.entries[i];

        // tagId required non-empty
        if (!entry.tagId || typeof entry.tagId !== 'string' || entry.tagId.trim() === '') {
            return { valid: false, error: 'Invalid recipe data: entry ' + i + ' missing tagId' };
        }

        // tagType required and one of valid types (case-insensitive)
        if (!entry.tagType || typeof entry.tagType !== 'string') {
            return { valid: false, error: 'Invalid recipe data: entry ' + i + ' missing tagType' };
        }

        var tagTypeLower = entry.tagType.toLowerCase();
        if (VALID_TAG_TYPES.indexOf(tagTypeLower) === -1) {
            return { valid: false, error: 'Invalid recipe data: entry ' + i + ' has invalid tagType "' + entry.tagType + '"' };
        }

        // value must be coercible if provided
        if (entry.value !== undefined && entry.value !== null && entry.value !== '') {
            var passThrough = (tagTypeLower === 'string' || tagTypeLower === 'word');
            var coerced = runtime.recipeService.coerceValue(entry.value, entry.tagType);
            if (!passThrough && coerced === entry.value && typeof entry.value === 'string' && entry.value !== '') {
                return { valid: false, error: "Invalid recipe data: value '" + entry.value + "' cannot be coerced to type '" + entry.tagType + "'" };
            }
        }
    }

    return { valid: true };
}

// ─── Import Helpers ───────────────────────────────────────────────────────────

function _importJson(content, name, desc) {
    var data;
    try {
        data = JSON.parse(content);
    } catch (e) {
        throw new Error('Invalid recipe data: invalid JSON');
    }

    if (name) data.name = name;
    if (desc) data.description = desc;

    var validation = _validateRecipeData(data);
    if (!validation.valid) throw new Error(validation.error);

    var id = 'r_' + crypto.randomBytes(6).toString('hex');
    (data.entries || []).forEach(function(entry) {
        entry.id = entry.id || 'e_' + crypto.randomBytes(4).toString('hex');
    });
    data.createdAt = data.createdAt || new Date().toISOString();
    data.updatedAt = new Date().toISOString();

    return runtime.recipeStorage.setRecipeData(id, data).then(function() {
        return { id: id, name: data.name, entriesCount: data.entries ? data.entries.length : 0 };
    });
}

function _importCsv(content, name, desc) {
    var lines = content.split('\n').filter(function(line) { return line.trim() !== ''; });
    if (lines.length < 2) {
        throw new Error('Invalid recipe data: CSV must have header and at least one data row');
    }

    var header = _parseCSVLine(lines[0]).map(function(h) { return h.trim().toLowerCase(); });

    var expectedHeader = ['tagid', 'tagname', 'tagtype', 'value'];
    for (var h = 0; h < expectedHeader.length; h++) {
        if (header[h] !== expectedHeader[h]) {
            throw new Error('Invalid recipe data: CSV header must be "tagId,tagName,tagType,value"');
        }
    }

    var entries = [];
    for (var i = 1; i < lines.length; i++) {
        var fields = _parseCSVLine(lines[i]);
        if (fields.length < 4) continue;

        var entry = { id: 'e_' + crypto.randomBytes(4).toString('hex') };
        for (var j = 0; j < header.length && j < fields.length; j++) {
            var fieldValue = fields[j];
            // Strip the formula-injection guard prefix added by _quoteCSVField on export
            // (only when it was actually applied: leading "'" followed by =, +, - or @)
            if (fieldValue.length > 1 && fieldValue[0] === "'" && /^[=+\-@]/.test(fieldValue[1])) {
                fieldValue = fieldValue.substring(1);
            }
            if (header[j] === 'tagid') entry.tagId = fieldValue;
            else if (header[j] === 'tagname') entry.tagName = fieldValue;
            else if (header[j] === 'tagtype') entry.tagType = fieldValue;
            else if (header[j] === 'value') entry.value = fieldValue;
        }
        entries.push(entry);
    }

    var data = {
        name: name || 'Imported Recipe',
        description: desc || '',
        entries: entries
    };

    var validation = _validateRecipeData(data);
    if (!validation.valid) throw new Error(validation.error);

    var id = 'r_' + crypto.randomBytes(6).toString('hex');
    data.createdAt = new Date().toISOString();
    data.updatedAt = new Date().toISOString();

    return runtime.recipeStorage.setRecipeData(id, data).then(function() {
        return { id: id, name: data.name, entriesCount: entries.length };
    });
}

// ─── CSV Helpers ──────────────────────────────────────────────────────────────

/**
 * Parse a single CSV line following RFC 4180 rules.
 * Handles quoted fields, escaped double-quotes (""), and commas inside quoted fields.
 */
function _parseCSVLine(line) {
    if (!line) return [''];

    var result = [];
    var current = '';
    var inQuotes = false;

    for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                result.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
    }
    result.push(current.trim());
    return result;
}

function _quoteCSVField(field) {
    if (field === null || field === undefined) return '';
    var str = String(field);
    // Neutralize Excel formula injection (CSV cells interpreted as formulas)
    if (/^[=+\-@]/.test(str)) {
        str = "'" + str;
    }
    return '"' + str.replace(/"/g, '""') + '"';
}

// ─── Promise Wrapper ─────────────────────────────────────────────────────────

function _handlePromise(promise, res, onSuccess, label) {
    promise.then(function(result) {
        if (typeof onSuccess === 'function') {
            onSuccess(result);
        } else {
            res.json(result);
        }
    }).catch(function(err) {
        runtime.logger.error('recipe-storage ' + label + ' error: ' + err);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    });
}
