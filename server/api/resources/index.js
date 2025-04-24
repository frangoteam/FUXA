/**
 * 'api/resources': Diagnose API to GET resources: images
 */

const fs = require('fs');
const path = require('path');
var express = require("express");
const authJwt = require('../jwt-helper');
const Report = require('../../runtime/jobs/report');

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
                    var result = {...req.query, ...{ groups: [] }};
                    var resourcesDirs = getDirectories(runtime.settings.imagesFileDir);
                    for (var i = 0; i < resourcesDirs.length; i++) {
                        var group = { name: resourcesDirs[i], items: [] };
                        var dirPath = path.resolve(runtime.settings.imagesFileDir, resourcesDirs[i]);
                        var wwwSubDir =  path.join('_images', resourcesDirs[i]);
                        var files =  getFiles(dirPath, ['.jpg','.jpeg', '.png', '.gif', '.svg']);
                        for (var x = 0; x < files.length; x++) {
                            var filename = files[x].replace(/\.[^\/.]+$/, '');
                            group.items.push({ path:  path.join(wwwSubDir, files[x]).split(path.sep).join(path.posix.sep), name: filename });
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
                    var result = {...req.query, ...{ groups: [] }};
                    var resourcesDirs = getDirectories(runtime.settings.widgetsFileDir);
                    for (var i = 0; i < resourcesDirs.length; i++) {
                        var group = { name: resourcesDirs[i], items: [] };
                        var dirPath = path.resolve(runtime.settings.widgetsFileDir, resourcesDirs[i]);
                        var wwwSubDir =  path.join('_widgets', resourcesDirs[i]);
                        var files =  getFiles(dirPath, ['.svg']);
                        for (var x = 0; x < files.length; x++) {
                            var filename = files[x];
                            group.items.push({ path:  path.join(wwwSubDir, files[x]).split(path.sep).join(path.posix.sep), name: filename });
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
                const relPath = req.body?.path;
                if (!relPath || typeof relPath !== 'string') {
                    return res.status(400).json({ error: "invalid_path", message: "Missing or invalid widget path." });
                }
                const basePath = path.resolve(runtime.settings.appDir);
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

function getDirectories (pathDir) {
    const directoriesInDIrectory = fs.readdirSync(pathDir, { withFileTypes: true })
        .filter((item) => item.isDirectory())
        .map((item) => item.name);
    return directoriesInDIrectory;
}

function getFiles (pathDir, extensions) {
    const filesInDIrectory = fs.readdirSync(pathDir)
        .filter((item) => extensions.indexOf(path.extname(item).toLowerCase()) !== -1);
    return filesInDIrectory;
}
