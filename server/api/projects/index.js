/**
 * 'api/project': Project API to GET/POST project data
 */

var express = require("express");
const authJwt = require('../jwt-helper');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { normalizeRelativePath, resolveWithin } = require('../path-helper');

var runtime;
var secureFnc;
var checkGroupsFnc;

module.exports = {
    init: function (_runtime, _secureFnc, _checkGroupsFnc) {
        runtime = _runtime;
        secureFnc = _secureFnc;
        checkGroupsFnc = _checkGroupsFnc;
    },
    app: function () {
        var prjApp = express();
        prjApp.use(function(req,res,next) {
            if (!runtime.project) {
                res.status(404).end();
            } else {
                next();
            }
        });

        /**
         * GET Project data
         * Take from project storage and reply
         */
        prjApp.get("/api/project", secureFnc, function(req, res) {
            const permission = checkGroupsFnc(req);
            const options = { lazyViews: runtime.settings.lazyViewLoading === true && req.query?.views === 'lazy' };
            runtime.project.getProject(req.userId, permission, options).then(result => {
                // res.header("Access-Control-Allow-Origin", "*");
                // res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
                if (result) {
                    if (!_isAdminRequest(req, permission)) {
                        result = _sanitizeProjectForViewer(result, permission);
                    }
                    res.json(result);
                } else {
                    res.status(404).end();
                    runtime.logger.error("api get project: Not Found!");
                }
            }).catch(function(err) {
                if (err && err.code) {
                    if (err.code !== 'ERR_HTTP_HEADERS_SENT') {
                        res.status(400).json({error:err.code, message: err.message});
                        runtime.logger.error("api get project: " + err.message);
                    }
                } else {
                    res.status(400).json({error:"unexpected_error", message: err});
                    runtime.logger.error("api get project: " + err);
                }
            });
        });

        /**
         * GET Project view data
         * Take one full view from project storage and reply
         */
        prjApp.get("/api/project/view/:id", secureFnc, function(req, res) {
            const permission = checkGroupsFnc(req);
            runtime.project.getProjectView(req.params.id, permission).then(result => {
                if (result) {
                    res.json(_isAdminRequest(req, permission) ? result : _sanitizeProjectForViewer({ hmi: { views: [result] } }).hmi.views[0]);
                } else {
                    res.status(404).end();
                    runtime.logger.error("api get project view: Not Found!");
                }
            }).catch(function(err) {
                if (err && err.code) {
                    if (err.code !== 'ERR_HTTP_HEADERS_SENT') {
                        res.status(400).json({error:err.code, message: err.message});
                        runtime.logger.error("api get project view: " + err.message);
                    }
                } else {
                    res.status(400).json({error:"unexpected_error", message: err});
                    runtime.logger.error("api get project view: " + err);
                }
            });
        });

        /**
         * POST Project data
         * Set to project storage
         */
        prjApp.post("/api/project", secureFnc, function(req, res, next) {
            const permission = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api post project: Tocken Expired");
            } else if (!authJwt.haveAdminPermission(permission)) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api post project: Unauthorized");
            } else {
                runtime.project.setProject(req.body).then(function(data) {
                    runtime.restart(true).then(function(result) {
                        res.end();
                    });
                }).catch(function(err) {
                    if (err && err.code) {
                        res.status(400).json({error:err.code, message: err.message});
                        runtime.logger.error("api post project: " + err.message);
                    } else {
                        res.status(400).json({error:"unexpected_error", message: err});
                        runtime.logger.error("api post project: " + err);
                    }
                });
            }
        });

        /**
         * POST Single Project data
         * Set the value (general/view/device/...) to project storage
         */
        prjApp.post("/api/projectData", secureFnc, function(req, res, next) {
            const permission = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api post projectData: Tocken Expired");
            } else if (!authJwt.haveAdminPermission(permission)) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api post projectData: Unauthorized");
            } else {
                runtime.project.setProjectData(req.body.cmd, req.body.data).then(setres => {
                    runtime.update(req.body.cmd, req.body.data).then(result => {
                        res.end();
                    });
                }).catch(function(err) {
                    if (err && err.code) {
                        res.status(400).json({error:err.code, message: err.message});
                        runtime.logger.error("api post projectData: " + err.message);
                    } else {
                        res.status(400).json({error:"unexpected_error", message: err});
                        runtime.logger.error("api post projectData: " + err);
                    }
                });
            }
        });

        /**
         * GET Project demo data
         * Take the project demo file from server folder
         */
        prjApp.get("/api/projectdemo", secureFnc, function (req, res) {
            const data = runtime.project.getProjectDemo();
            // res.header("Access-Control-Allow-Origin", "*");
            // res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            if (data) {
                res.json(data);
            } else {
                res.status(404).end();
                runtime.logger.error("api get project: Not Found!");
            }
        });

        /**
         * GET Device property like security
         * Take from project storage and reply
         */
        prjApp.get("/api/device", secureFnc, function(req, res) {
            const permission = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api get device: Tocken Expired");
            } else if (!authJwt.haveAdminPermission(permission)) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api get device: Unauthorized");
            } else {
                runtime.project.getDeviceProperty(req.query).then(result => {
                    // res.header("Access-Control-Allow-Origin", "*");
                    // res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
                    if (result) {
                        res.json(result);
                    } else {
                        res.end();
                    }
                }).catch(function(err) {
                    if (err && err.code) {
                        res.status(400).json({error:err.code, message: err.message});
                        runtime.logger.error("api get device: " + err.message);
                    } else {
                        res.status(400).json({error:"unexpected_error", message: err});
                        runtime.logger.error("api get device: " + err);
                    }
                });
            }
        });

        /**
         * POST Device property
         * Set to project storage
         */
        prjApp.post("/api/device", secureFnc, function(req, res, next) {
            const permission = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api post device: Tocken Expired");
            } else if (!authJwt.haveAdminPermission(permission)) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api post device: Unauthorized");
            } else {
                runtime.project.setDeviceProperty(req.body.params).then(function(data) {
                    res.end();
                }).catch(function(err) {
                    if (err && err.code) {
                        res.status(400).json({error:err.code, message: err.message});
                        runtime.logger.error("api post device: " + err.message);
                    } else {
                        res.status(400).json({error:"unexpected_error", message: err});
                        runtime.logger.error("api post device: " + err);
                    }
                });
            }
        });

        /**
         * POST Upload file resource
         * images will be in media file saved
         */
        prjApp.post('/api/upload', secureFnc, function (req, res) {
            const permission = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api get device: Tocken Expired");
                return;
            } else if (!authJwt.haveAdminPermission(permission)) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api get device: Unauthorized");
                return;
            }
            const file = req.body.resource;
            const destination = req.body.destination;
            try {
                let basedata = file.data;
                let encoding = {};
                // let basedata = file.data.replace(/^data:.*,/, '');
                // let basedata = file.data.replace(/^data:image\/png;base64,/, "");
                const rawFileName = typeof file.name === 'string' ? file.name : '';
                const safeFileName = normalizeRelativePath(rawFileName);
                const safeFullPath = normalizeRelativePath(file.fullPath || rawFileName);
                const relativePath = safeFullPath || safeFileName;
                if (!relativePath) {
                    res.status(400).json({error:"invalid_path", message: "Invalid upload path."});
                    return;
                }

                if (file.type !== 'svg') {
                    basedata = file.data.replace(/^data:.*,/, '');
                    encoding = {encoding: 'base64'};
                }
                const resolvedUpload = resolveWithin(runtime.settings.uploadFileDir, relativePath);
                if (!resolvedUpload) {
                    res.status(400).json({error:"invalid_path", message: "Invalid upload path."});
                    return;
                }
                let filePath = resolvedUpload.resolvedTarget;
                if (destination) {
                    const baseDir = process.versions.electron
                        ? (process.env.userDir || path.join(os.homedir(), '.fuxa'))
                        : runtime.settings.appDir;
                    const normalizedDestination = normalizeRelativePath(destination);
                    if (!normalizedDestination) {
                        res.status(400).json({error:"invalid_destination", message: "Invalid destination path."});
                        return;
                    }
                    const resolvedDestination = resolveWithin(baseDir, `_${normalizedDestination}`);
                    if (!resolvedDestination) {
                        res.status(400).json({error:"invalid_destination", message: "Invalid destination path."});
                        return;
                    }
                    const destinationDir = resolvedDestination.resolvedTarget;
                    const resolvedFile = resolveWithin(destinationDir, relativePath);
                    if (!resolvedFile) {
                        res.status(400).json({error:"invalid_path", message: "Invalid upload path."});
                        return;
                    }
                    filePath = resolvedFile.resolvedTarget;
                    const dir = path.dirname(filePath);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }
                }
                fs.writeFileSync(filePath, basedata, encoding);
                let result = {'location': runtime.settings.httpUploadFileStatic + '/' + relativePath };
                res.json(result);
            } catch (err) {
                if (err && err.code) {
                    res.status(400).json({error: err.code, message: err.message});
                    runtime.logger.error("api upload: " + err.message);
                } else {
                    res.status(400).json({error:"unexpected_error", message: err});
                    runtime.logger.error("api upload: " + err);
                }
            }
        });

        return prjApp;
    }
}

function _isAdminRequest(req, permission) {
    if (!runtime.settings?.secureEnabled) {
        return true;
    }
    if (authJwt.isGuestUser(req.userId, req.userGroups)) {
        return false;
    }
    return req.userId === 'admin' || authJwt.haveAdminPermission(permission);
}

function _sanitizeProjectForViewer(project, permission) {
    const sanitized = JSON.parse(JSON.stringify(project));
    const sensitiveProperty = /(?:user.?name|pass(?:word|phrase)?|secret|token|credential|private.?key|certificate|\bcert\b|auth(?:entication|orization)?(?:header|token|key|password)?|api.?key|community|priv.?key)/i;

    if (Array.isArray(sanitized.recipes)) {
        const referencedRecipeIds = _getReferencedRecipeIds(sanitized.hmi, permission);
        sanitized.recipes = sanitized.recipes.filter(recipe => recipe && referencedRecipeIds.has(recipe.id));
    }
    if (Array.isArray(sanitized.recipes) && typeof runtime.checkPermission === 'function') {
        sanitized.recipes = sanitized.recipes.filter(recipe => {
            if (!recipe) return false;
            const recipePermission = runtime.checkPermission(permission, recipe, false, true);
            return recipePermission?.show !== false;
        });
    }
    if (Array.isArray(sanitized.scripts) && runtime.scriptsMgr?.isAuthorised) {
        sanitized.scripts = sanitized.scripts.filter(script => runtime.scriptsMgr.isAuthorised(script, permission));
    }

    function removeSensitiveProperties(value) {
        if (!value || typeof value !== 'object') {
            return;
        }
        for (const key of Object.keys(value)) {
            if (sensitiveProperty.test(key)) {
                delete value[key];
            } else if (typeof value[key] === 'string') {
                // Secrets may be embedded in query strings (for example, a device URL).
                value[key] = value[key].replace(/([?&](?:access[_-]?token|auth[_-]?token|token|api[_-]?key|apikey|secret|password|authorization)=)[^&#]*/gi, '$1[REDACTED]');
            } else {
                removeSensitiveProperties(value[key]);
            }
        }
    }

    removeSensitiveProperties(sanitized);
    // Receiver addresses are only needed for project configuration, not HMI runtime.
    for (const notification of Array.isArray(sanitized.notifications) ? sanitized.notifications : []) {
        if (notification && typeof notification === 'object') delete notification.receiver;
    }
    for (const report of Array.isArray(sanitized.reports) ? sanitized.reports : []) {
        if (report && typeof report === 'object') delete report.receiver;
    }
    if (Array.isArray(sanitized.scripts)) {
        for (const script of sanitized.scripts) {
            if (script && script.mode !== 'CLIENT') {
                delete script.code;
            }
            if (script && script.mode !== 'CLIENT' && Array.isArray(script.parameters)) {
                // Preserve ordinary runtime parameter values; redact values explicitly
                // identified as credentials while retaining binding name/type metadata.
                for (const parameter of script.parameters) {
                    if (parameter && typeof parameter === 'object' && sensitiveProperty.test(parameter.name || '')) {
                        delete parameter.value;
                    }
                }
            }
        }
    }
    return sanitized;
}

function _getReferencedRecipeIds(hmi, permission) {
    const recipeIds = new Set();
    for (const view of Array.isArray(hmi?.views) ? hmi.views : []) {
        for (const item of Object.values(view?.items || {})) {
            if (!item?.property?.recipeId) {
                continue;
            }
            if (typeof runtime.checkPermission === 'function') {
                const itemPermission = runtime.checkPermission(permission, item.property, false, true);
                if (itemPermission?.show === false) {
                    continue;
                }
            }
            recipeIds.add(item.property.recipeId);
        }
    }
    return recipeIds;
}
