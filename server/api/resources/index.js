/**
 * 'api/resources': Diagnose API to GET resources: images
 */

const fs = require('fs');
const path = require('path');
var express = require("express");
const authJwt = require('../jwt-helper');
const Report = require('../../runtime/jobs/report');
const fontkit = require('fontkit');
const os = require('os');

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
        var resourcesApp = express();
        resourcesApp.use(function (req, res, next) {
            if (!runtime.project) {
                res.status(404).end();
            } else {
                next();
            }
        });

        /**
         * GET Server images folder content
         */
        resourcesApp.get('/api/resources/images', secureFnc, function (req, res) {
            const permission = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api get resources/images: Tocken Expired");
            } else if (!authJwt.haveAdminPermission(permission)) {
                res.status(401).json({ error: "unauthorized_error", message: "Unauthorized!" });
                runtime.logger.error("api get resources/images: Unauthorized!");
            } else {
                try {
                    var result = { ...req.query, ...{ groups: [] } };
                    var resourcesDirs = getDirectories(runtime.settings.imagesFileDir);
                    for (var i = 0; i < resourcesDirs.length; i++) {
                        var group = { name: resourcesDirs[i], items: [] };
                        var dirPath = path.resolve(runtime.settings.imagesFileDir, resourcesDirs[i]);
                        var wwwSubDir = path.join('_images', resourcesDirs[i]);
                        var files = getFiles(dirPath, ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.mp4', '.webm', '.ogg', '.ogv']);
                        for (var x = 0; x < files.length; x++) {
                            var filename = files[x].replace(/\.[^\/.]+$/, '');
                            group.items.push({ path: path.join(wwwSubDir, files[x]).split(path.sep).join(path.posix.sep), name: filename });
                        }
                        result.groups.push(group);
                    }
                    res.json(result);
                } catch (err) {
                    if (err.code) {
                        res.status(400).json({ error: err.code, message: err.message });
                    } else {
                        res.status(400).json({ error: "unexpected_error", message: err.toString() });
                    }
                    runtime.logger.error("api get resources/images: " + err.message);
                }
            }
        });

        /**
         * GET Server resources folder content
         */
        resourcesApp.get('/api/resources/resources', secureFnc, function (req, res) {
            const permission = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api get resources/resources: Tocken Expired");
            } else if (!authJwt.haveAdminPermission(permission)) {
                res.status(401).json({ error: "unauthorized_error", message: "Unauthorized!" });
                runtime.logger.error("api get resources/resources: Unauthorized!");
            } else {
                try {
                    const resourcesFilter = { fonts: ['ttf'] };
                    const wwwSubDir = '_resources';
                    const result = { ...req.query, ...{ groups: [] } };
                    const group = { name: wwwSubDir, items: [] };
                    var files = getFiles(runtime.settings.resourcesFileDir, ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.pdf', '.ttf', '.mp4', '.webm', '.ogg', '.ogv']);
                    for (var x = 0; x < files.length; x++) {
                        const fileName = files[x];
                        const filePath = path.join(wwwSubDir, files[x]).split(path.sep).join(path.posix.sep);
                        var fileLabel;
                        if (resourcesFilter.fonts.some(suffix => fileName.endsWith(suffix))) {
                            const font = fontkit.openSync(filePath);
                            fileLabel = font.fullName;
                        }

                        group.items.push({
                            path: filePath,
                            name: fileName,
                            label: fileLabel
                        });
                    }
                    result.groups.push(group);
                    res.json(result);
                } catch (err) {
                    if (err.code) {
                        res.status(400).json({ error: err.code, message: err.message });
                    } else {
                        res.status(400).json({ error: "unexpected_error", message: err.toString() });
                    }
                    runtime.logger.error("api get resources/resources: " + err.message);
                }
            }
        });

        /**
         * POST remove resource file
         */
        resourcesApp.post('/api/resources/remove', function (req, res) {
            const permission = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api post device: Tocken Expired");
            } else if (!authJwt.haveAdminPermission(permission)) {
                res.status(401).json({ error: "unauthorized_error", message: "Unauthorized!" });
                runtime.logger.error("api post remove resource: Unauthorized");
            } else {
                try {
                    let fileName = req.body.file.replace(new RegExp('../', 'g'), '');
                    const filePath = path.join(runtime.settings.resourcesFileDir, fileName);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                    runtime.logger.info(`resources '${filePath}' deleted!`, true);
                    res.end();
                } catch (err) {
                    if (err && err.code) {
                        res.status(400).json({ error: err.code, message: err.message });
                        runtime.logger.error("api remove resource: " + err.message);
                    } else {
                        res.status(400).json({ error: "unexpected_error", message: err });
                        runtime.logger.error("api remove resource: " + err);
                    }
                }
            }
        });

        /**
         * GET svg/canvas rendered and converted to image
         */
        resourcesApp.get('/api/resources/generateImage', secureFnc, function (req, res) {
            const permission = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api get resources/generateImage: Tocken Expired");
            } else if (!authJwt.haveAdminPermission(permission)) {
                res.status(401).json({ error: "unauthorized_error", message: "Unauthorized!" });
                runtime.logger.error("api get resources/generateImage: Unauthorized!");
            } else {
                try {
                    var query = JSON.parse(req.query.param);
                    const report = Report.create(null, runtime);
                    report.getChartImage(query).then((content) => {
                        res.end(content.toString('base64'));
                    }).catch(function (err) {
                        if (err.code) {
                            res.status(400).json({ error: err.code, message: err.message });
                        } else {
                            res.status(400).json({ error: "unexpected_error", message: err.toString() });
                        }
                        runtime.logger.error("createImage: " + err.message);
                    });
                } catch (err) {
                    if (err.code) {
                        res.status(400).json({ error: err.code, message: err.message });
                    } else {
                        res.status(400).json({ error: "unexpected_error", message: err.toString() });
                    }
                    runtime.logger.error("api get resources/generateImage: " + err.message);
                }
            }
        });

        /**
         * GET Templates
         * Take from resources storage and reply
         */
        resourcesApp.get("/api/resources/templates", secureFnc, function (req, res) {
            const permission = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api get templates: Tocken Expired");
            } else if (!authJwt.haveAdminPermission(permission)) {
                res.status(401).json({ error: "unauthorized_error", message: "Unauthorized!" });
                runtime.logger.error("api get templates: Unauthorized!");
            } else {
                runtime.resourcesMgr.getTemplates(req.query).then(result => {
                    // res.header("Access-Control-Allow-Origin", "*");
                    // res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
                    if (result) {
                        result.forEach(template => {
                            template.content = JSON.parse(template.content);
                        });
                        res.json(result);
                    } else {
                        res.end();
                    }
                }).catch(function (err) {
                    if (err.code) {
                        res.status(400).json({ error: err.code, message: err.message });
                    } else {
                        res.status(400).json({ error: "unexpected_error", message: err.toString() });
                    }
                    runtime.logger.error("api get templates: " + err.message);
                });
            }
        });

        /**
         * POST template
         */
        resourcesApp.post('/api/resources/template', function (req, res) {
            const permission = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api post device: Tocken Expired");
            } else if (!authJwt.haveAdminPermission(permission)) {
                res.status(401).json({ error: "unauthorized_error", message: "Unauthorized!" });
                runtime.logger.error("api post template: Unauthorized");
            } else {
                runtime.resourcesMgr.setTemplate(req.body.template).then((data) => {
                    res.end();
                }).catch(function (err) {
                    if (err.code) {
                        res.status(400).json({ error: err.code, message: err.message });
                    } else {
                        res.status(400).json({ error: "unexpected_error", message: err.toString() });
                    }
                    runtime.logger.error("api post template: " + err.message);
                });
            }
        });

        /**
         * DELETE template
         */
        resourcesApp.delete("/api/resources/templates", secureFnc, function (req, res, next) {
            const permission = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api delete templates: Tocken Expired");
            } else if (!authJwt.haveAdminPermission(permission)) {
                res.status(401).json({ error: "unauthorized_error", message: "Unauthorized!" });
                runtime.logger.error("api delete templates: Unauthorized");
            } else {
                runtime.resourcesMgr.removeTemplates(req.query.templates).then((data) => {
                    res.end();
                }).catch(function (err) {
                    if (err.code) {
                        res.status(400).json({ error: err.code, message: err.message });
                    } else {
                        res.status(400).json({ error: "unexpected_error", message: err.toString() });
                    }
                    runtime.logger.error("api delete templates: " + err.message);
                });
            }
        });

        /**
        * GET Server widgets folder content
        */
        resourcesApp.get('/api/resources/widgets', secureFnc, function (req, res) {
            const permission = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api get resources/widgets: Tocken Expired");
            } else if (!authJwt.haveAdminPermission(permission)) {
                res.status(401).json({ error: "unauthorized_error", message: "Unauthorized!" });
                runtime.logger.error("api get resources/widgets: Unauthorized!");
            } else {
                try {
                    var result = { ...req.query, ...{ groups: [] } };
                    var resourcesDirs = getDirectories(runtime.settings.widgetsFileDir);
                    for (var i = 0; i < resourcesDirs.length; i++) {
                        var group = { name: resourcesDirs[i], items: [] };
                        var dirPath = path.resolve(runtime.settings.widgetsFileDir, resourcesDirs[i]);
                        var wwwSubDir = path.join('_widgets', resourcesDirs[i]);
                        var files = getFiles(dirPath, ['.svg']);
                        for (var x = 0; x < files.length; x++) {
                            var filename = files[x];
                            group.items.push({ path: path.join(wwwSubDir, files[x]).split(path.sep).join(path.posix.sep), name: filename });
                        }
                        result.groups.push(group);
                    }
                    res.json(result);
                } catch (err) {
                    if (err.code) {
                        res.status(400).json({ error: err.code, message: err.message });
                    } else {
                        res.status(400).json({ error: "unexpected_error", message: err.toString() });
                    }
                    runtime.logger.error("api get resources/widgets: " + err.message);
                }
            }
        });

        /**
         * POST Remove Server widget item
         */
        resourcesApp.post('/api/resources/removeWidget', secureFnc, function (req, res) {
            const permission = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api resources/removeWidget: Tocken Expired");
            } else if (!authJwt.haveAdminPermission(permission)) {
                runtime.logger.error("api resources/removeWidget: Unauthorized!");
                return res.status(401).json({ error: "unauthorized_error", message: "Unauthorized!" });
            }
            try {
                let relPath = req.body?.path;
                relPath = relPath.replace(new RegExp('\\.\\.\/', 'g'), '');
                if (!relPath || typeof relPath !== 'string') {
                    return res.status(400).json({ error: "invalid_path", message: "Missing or invalid widget path." });
                }
                let basePath = path.resolve(runtime.settings.appDir);
                if (process.versions.electron) {
                    basePath = process.env.userDir || path.join(os.homedir(), '.fuxa');
                }
                const fullPath = path.resolve(basePath, relPath);

                if (!fullPath.startsWith(basePath)) {
                    runtime.logger.error("api resources/widgets: security_violation " + fullPath);
                    return res.status(403).json({ error: 'security_violation', message: 'Invalid path' });
                }

                if (!fs.existsSync(fullPath)) {
                    return res.status(404).json({ error: "not_found", message: "Widget file not found." });
                }

                try {
                    fs.unlinkSync(fullPath);
                    res.json({ success: true, path: relPath });
                } catch (err) {
                    runtime.logger.error("api removeWidget: " + err.message);
                    res.status(500).json({ error: "delete_failed", message: err.message });
                }
            } catch (err) {
                if (err.code) {
                    res.status(400).json({ error: err.code, message: err.message });
                } else {
                    res.status(400).json({ error: "unexpected_error", message: err.toString() });
                }
                runtime.logger.error("api resources/removeWidget: " + err.message);
            }
        });

        return resourcesApp;
    }
}

function getDirectories(pathDir) {
    const directoriesInDIrectory = fs.readdirSync(pathDir, { withFileTypes: true })
        .filter((item) => item.isDirectory())
        .map((item) => item.name);
    return directoriesInDIrectory;
}

function getFiles(pathDir, extensions) {
    const filesInDIrectory = fs.readdirSync(pathDir)
        .filter((item) => extensions.indexOf(path.extname(item).toLowerCase()) !== -1);
    return filesInDIrectory;
}
