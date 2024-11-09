
const authJwt = require('../api/jwt-helper');
import express, { Request, Response } from 'express';

export class ReportsApiService {

    runtime: any;
    secureFnc: any;
    checkGroupsFnc: any;

    init(_runtime: any, _secureFnc: any, _checkGroupsFnc: any) {
        this.runtime = _runtime;
        this.secureFnc = _secureFnc;
        this.checkGroupsFnc = _checkGroupsFnc;
    }

    app() {
        var reportsApp = express();
        reportsApp.use((req, res, next) => {
            if (!this.runtime.project) {
                res.status(404).end();
            } else {
                next();
            }
        });

        /**
         * GET current Alarms
         * Take from alarms storage and reply
         */
        reportsApp.get('/api/reportsQuery', this.secureFnc, (req: Request, res: Response) => {
            var groups = this.checkGroupsFnc(req);
			 if (res.statusCode === 403) {
                this.runtime.logger.error('api get alarms: Tocken Expired');
            } else {
                try {
                    var myFilter = req.query?.filter as ReportsFilterType;
                    // var filter = myFilter ?? JSON.parse(myFilter);

                    // res.header("Access-Control-Allow-Origin", "*");
                    // res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

                    // const fileName = req.query.name.replace(new RegExp('../', 'g'), '');
                    // var reportPath = path.join(runtime.settings.reportsDir, fileName);
                    // if (!fs.existsSync(reportPath)) {
                    //     reportPath = path.join(process.cwd(), runtime.settings.reportsDir, fileName);
                    // }
                    // if (fs.existsSync(reportPath)) {
                    //     res.sendFile(reportPath, (err) => {
                    //         if (err) {
                    //             runtime.logger.error("api get download: " + err);
                    //         }
                    //     });
                    // } else {
                    //     res.status(400).json({ error: "not_found", message: 'report not found!'});
                    //     runtime.logger.error("api get download: " + 'report not found!');
                    // }
                    // if (result) {
                    //     res.json(result);
                    // } else {
                    //     res.end();
                    // }
                } catch (err) {
                    if (err instanceof Error) {
                        res.status(400).json({error: err.stack, message: err.message});
                    } else {
                        res.status(400).json({error:'unexpected_error', message: err});
                    }
                    this.runtime.logger.error('api get alarms: ' + err);
                }
			}
        });

        /**
         * POST Plugin
         * Install the plugin
         */
        // pluginsApp.post("/api/plugins", secureFnc, function (req, res, next) {
        //     var groups = checkGroupsFnc(req);
        //     if (res.statusCode === 403) {
        //         runtime.logger.error("api post plugins: Tocken Expired");
        //     } else if (authJwt.adminGroups.indexOf(groups) === -1) {
        //         res.status(401).json({ error: "unauthorized_error", message: "Unauthorized!" });
        //         runtime.logger.error("api post plugins: Unauthorized");
        //     } else {
        //         runtime.plugins.addPlugin(req.body.params, true).then(function (data) {
        //             runtime.devices.update();
        //             res.end();
        //         }).catch(function (err) {
        //             if (err.code) {
        //                 res.status(400).json({ error: err.code, message: err.message });
        //             } else {
        //                 res.status(400).json({ error: "unexpected_error", message: err.toString() });
        //             }
        //             runtime.logger.error("api install plugins: " + err.message);
        //         });
        //     }
        // });

        /**
         * DELETE Plugin
         * Unistall the plugin
         */
        // pluginsApp.delete("/api/plugins", secureFnc, function (req, res, next) {
        //     var groups = checkGroupsFnc(req);
        //     if (res.statusCode === 403) {
        //         runtime.logger.error("api delete plugins: Tocken Expired");
        //     } else if (authJwt.adminGroups.indexOf(groups) === -1) {
        //         res.status(401).json({ error: "unauthorized_error", message: "Unauthorized!" });
        //         runtime.logger.error("api delete plugins: Unauthorized");
        //     } else {
        //         runtime.plugins.removePlugin(req.query.param).then(function (data) {
        //             res.end();
        //         }).catch(function (err) {
        //             if (err.code) {
        //                 res.status(400).json({ error: err.code, message: err.message });
        //             } else {
        //                 res.status(400).json({ error: "unexpected_error", message: err.toString() });
        //             }
        //             runtime.logger.error("api delete plugins: " + err.message);
        //         });
        //     }
        // });
        return reportsApp;
    }
}

export interface ReportsFilterType {
    name?: string;
    count?: string;
}