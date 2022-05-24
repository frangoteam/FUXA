/**
 * 'api/resources': Diagnose API to GET resources: images
 */

const fs = require('fs');
const path = require('path');
const svgson = require('svgson');
var express = require("express");
const authJwt = require('../jwt-helper');
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
         * GET Server logs folder content
         */
        resourcesApp.get('/api/resources/images', secureFnc, function (req, res) {
            var groups = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api get resources/images: Tocken Expired");
            } else if (authJwt.adminGroups.indexOf(groups) === -1) {
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
                        var files = getFiles(dirPath, ['.jpg', '.jpeg', '.png', '.gif', '.svg']);
                        for (var x = 0; x < files.length; x++) {
                            group.items.push({ path: path.join(wwwSubDir, files[x]).split(path.sep).join(path.posix.sep) });
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

        resourcesApp.get('/api/resources/shapes', secureFnc, function (req, res) {
            var groups = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api get resources/shapes: Tocken Expired");
            } else if (authJwt.adminGroups.indexOf(groups) === -1) {
                res.status(401).json({ error: "unauthorized_error", message: "Unauthorized!" });
                runtime.logger.error("api get resources/shapes: Unauthorized!");
            } else {
                try {
                    var result = { ...req.query, ...{ groups: [] } };
                    var resourcesDirs = getDirectories(runtime.settings.shapesFileDir);
                    for (var i = 0; i < resourcesDirs.length; i++) {
                        var group = { name: resourcesDirs[i], items: [] };
                        var dirPath = path.resolve(runtime.settings.shapesFileDir, resourcesDirs[i]);
                        var wwwSubDir = path.join('_shapes', resourcesDirs[i]);
                        var files = getFiles(dirPath, ['.svg']);
                        for (var x = 0; x < files.length; x++) {
                            group.items.push({ path: path.join(wwwSubDir, files[x]).split(path.sep).join(path.posix.sep) });
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
                    runtime.logger.error("api get resources/shapes: " + err.message);
                }
            }
        });

        resourcesApp.get('/api/resources/json-shapes/:group', secureFnc, function (req, res) {
            var groups = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api get resources/shapes: Tocken Expired");
            } else if (authJwt.adminGroups.indexOf(groups) === -1) {
                res.status(401).json({ error: "unauthorized_error", message: "Unauthorized!" });
                runtime.logger.error("api get resources/shapes: Unauthorized!");
            } else {
                try {
                    var result = { ...req.query, ...{ groups: [] } };
                    var resourcesDirs = getDirectories(runtime.settings.shapesFileDir);
                    var resourcesGroup = resourcesDirs.find((item) => item === req.params.group);
                    if (!resourcesGroup) {
                        res.status(404).json({ error: "not_found", message: "Group not found!" });
                    }
                    var dirPath = path.resolve(runtime.settings.shapesFileDir, resourcesGroup);
                    let shapesData = getShapesInfo(dirPath);
                    let shapesFiles = getFiles(dirPath, ['.svg']);
                    let shapesPromises = [];

                    for (let i = 0; i < shapesFiles.length; i++) {
                        shapesPromises.push(getSvgContents(path.join(dirPath, shapesFiles[i])));
                    }

                    Promise.all(shapesPromises).then(function (shapesContent) {

                        let shapes = []
                        for (var x = 0; x < shapesFiles.length; x++) {
                            let shape = {
                                name: shapesFiles[x],
                                ico: 'http://localhost:1881/' + path.join('_shapes', resourcesGroup, 'icons', shapesFiles[x]).split(path.sep).join(path.posix.sep),
                                content: shapesContent[x]
                            }
                            shapes.push(shape);
                        }
                        shapesData.shapes = shapes;
                        res.json(shapesData);
                    });
                } catch (err) {
                    if (err.code) {
                        res.status(400).json({ error: err.code, message: err.message });
                    } else {
                        res.status(400).json({ error: "unexpected_error", message: err.toString() });
                    }
                    runtime.logger.error("api get resources/shapes: " + err.message);
                }
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

function getShapesInfo(pathDir) {
    return groupInfo = JSON.parse(fs.readFileSync(`${pathDir}/0.json`, 'utf8'));
}

async function getSvgContents(pathDir) {
    const svg = fs.readFileSync(pathDir, 'utf8');
    let svgContent = await svgson.parse(svg)
    svgContent = svgContent.children
    let svgParsed = []
    svgContent.forEach(element => {
        element.attr = element.attributes;
        element.type = element.name;
        svgParsed.push(element)
        delete element.attributes
        delete element.value
    });
    return svgParsed;

}