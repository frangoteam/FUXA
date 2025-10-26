"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsApiService = void 0;
const authJwt = require('../api/jwt-helper');
const fs = require('fs');
const path = require('path');
const express_1 = __importDefault(require("express"));
class ReportsApiService {
    init(_runtime, _secureFnc, _checkGroupsFnc) {
        this.runtime = _runtime;
        this.secureFnc = _secureFnc;
        this.checkGroupsFnc = _checkGroupsFnc;
    }
    app() {
        var reportsApp = (0, express_1.default)();
        reportsApp.use((req, res, next) => {
            if (!this.runtime.project) {
                res.status(404).end();
            }
            else {
                next();
            }
        });
        /**
         * GET reports with filter and check authorization
         */
        reportsApp.get('/api/reportsQuery', this.secureFnc, (req, res) => {
            var groups = this.checkGroupsFnc(req);
            if (res.statusCode === 403) {
                this.runtime.logger.error('api get alarms: Tocken Expired');
            }
            else {
                try {
                    var filter = JSON.parse(req.query.query);
                    // res.header("Access-Control-Allow-Origin", "*");
                    // res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
                    var reportPath = this.runtime.settings.reportsDir;
                    if (!fs.existsSync(reportPath)) {
                        reportPath = path.join(process.cwd(), this.runtime.settings.reportsDir);
                    }
                    var reportFiles = fs.readdirSync(reportPath);
                    var result = [];
                    for (var i = 0; i < reportFiles?.length; i++) {
                        const file = reportFiles[i];
                        try {
                            const fileName = file.replace(/\.[^/.]+$/, "");
                            if (filter.name && fileName.indexOf(filter.name) === -1) {
                                continue;
                            }
                            const reportName = fileName.replace(/_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/, '');
                            const created = this.getDate(fileName);
                            result.push({
                                fileName: file,
                                reportName,
                                created
                            });
                        }
                        catch (err) {
                            console.log(`Parsing ${file} Error ${err}`);
                        }
                    }
                    if (filter.count) {
                        result = result.filter(item => item.created !== null)
                            .sort((a, b) => b.created.getTime() - a.created.getTime())
                            .slice(0, filter.count);
                    }
                    res.json(result);
                }
                catch (err) {
                    if (err instanceof Error) {
                        res.status(400).json({ error: err.stack, message: err.message });
                    }
                    else {
                        res.status(400).json({ error: 'unexpected_error', message: err });
                    }
                    this.runtime.logger.error('api get reportsQuery: ' + err);
                }
            }
        });
        /**
         * POST build report
         */
        reportsApp.post("/api/reportBuild", this.secureFnc, (req, res, next) => {
            var groups = this.checkGroupsFnc(req);
            if (res.statusCode === 403) {
                this.runtime.logger.error("api post reportBuild: Tocken Expired");
            }
            else if (authJwt.adminGroups.indexOf(groups) === -1) {
                res.status(401).json({ error: "unauthorized_error", message: "Unauthorized!" });
                this.runtime.logger.error("api post reportBuild: Unauthorized");
            }
            else {
                try {
                    if (this.runtime.jobsMgr.forceReport(req.body.params)) {
                        res.end();
                    }
                    else {
                        res.status(400).json({ error: "not_found", message: 'report not found!' });
                        this.runtime.logger.error("api post reportBuild: " + 'report not found!');
                    }
                }
                catch (error) {
                    res.status(400).json({ error: "error", message: error });
                    this.runtime.logger.error("api post reportBuild: " + error);
                }
            }
        });
        /**
         * POST remove report file
         */
        reportsApp.post("/api/reportRemoveFile", this.secureFnc, (req, res, next) => {
            var groups = this.checkGroupsFnc(req);
            if (res.statusCode === 403) {
                this.runtime.logger.error("api post reportRemoveFile: Tocken Expired");
            }
            else if (authJwt.adminGroups.indexOf(groups) === -1) {
                res.status(401).json({ error: "unauthorized_error", message: "Unauthorized!" });
                this.runtime.logger.error("api post reportRemoveFile: Unauthorized");
            }
            else {
                try {
                    var reportPath = this.runtime.settings.reportsDir;
                    if (!fs.existsSync(reportPath)) {
                        reportPath = path.join(process.cwd(), this.runtime.settings.reportsDir, req.params);
                    }
                    const filePath = path.join(reportPath, req.body.params?.fileName);
                    fs.unlinkSync(filePath);
                    this.runtime.logger.info(`Report file '${filePath}' deleted!`, true);
                    res.end();
                }
                catch (error) {
                    res.status(400).json({ error: "error", message: error });
                    this.runtime.logger.error("api post reportRemoveFile: " + error);
                }
            }
        });
        return reportsApp;
    }
    getDate(input) {
        if (input instanceof Date) {
            const yyyy = input.getFullYear();
            const mm = String(input.getMonth() + 1).padStart(2, '0');
            const dd = String(input.getDate()).padStart(2, '0');
            const HH = String(input.getHours()).padStart(2, '0');
            const MM = String(input.getMinutes()).padStart(2, '0');
            const SS = String(input.getSeconds()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}_${HH}-${MM}-${SS}`;
        }
        if (typeof input === 'string') {
            const datePattern = /_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})$/;
            const match = input.match(datePattern);
            if (match) {
                const [_, yyyy, mm, dd, HH, MM, SS] = match.map(Number);
                return new Date(yyyy, mm - 1, dd, HH, MM, SS);
            }
            else {
                throw new Error("Format not valid!: 'YYYY-MM-DD_HH-MM-SS'");
            }
        }
        throw new Error("Input not valid!");
    }
}
exports.ReportsApiService = ReportsApiService;
