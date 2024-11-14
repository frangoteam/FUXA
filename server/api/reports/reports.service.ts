
const authJwt = require('../api/jwt-helper');
const fs = require('fs');
const path = require('path');
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
         * GET reports with filter and check authorization
         */
        reportsApp.get('/api/reportsQuery', this.secureFnc, (req: Request, res: Response) => {
            var groups = this.checkGroupsFnc(req);
			 if (res.statusCode === 403) {
                this.runtime.logger.error('api get alarms: Tocken Expired');
            } else {
                try {
                    var myFilter = req.query as ReportsFilterType;
                    var filter = myFilter ?? JSON.parse(myFilter);
                    // res.header("Access-Control-Allow-Origin", "*");
                    // res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
                    var reportPath = this.runtime.settings.reportsDir;
                    if (!fs.existsSync(reportPath)) {
                        reportPath = path.join(process.cwd(), this.runtime.settings.reportsDir);
                    }
                    var reportFiles = fs.readdirSync(reportPath);
                    // reportFiles = reportFiles.filter(file => file.startsWith(req.query.name + '_'));
                    var result: ReportFile[] = [];
                    reportFiles?.forEach((file: string) => {
                        try {
                            const fileName = file.replace(/\.[^/.]+$/, "");
                            const reportName = fileName.replace(/_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/, '');
                            const created = <Date>this.getDate(fileName);
                            result.push({
                                fileName,
                                reportName,
                                created
                            });
                        } catch (err) {
                            console.log(`Parsing ${file} Error ${err}`);
                        }
                    });
                    res.json(result);
                } catch (err) {
                    if (err instanceof Error) {
                        res.status(400).json({error: err.stack, message: err.message});
                    } else {
                        res.status(400).json({error:'unexpected_error', message: err});
                    }
                    this.runtime.logger.error('api get reportsQuery: ' + err);
                }
			}
        });

        return reportsApp;
    }

    getDate(input: Date | string) {
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
            } else {
                throw new Error("Format not valid!: 'YYYY-MM-DD_HH-MM-SS'");
            }
        }
        throw new Error("Input not valid!");
    }
}

export interface ReportsFilterType {
    name?: string;
    count?: string;
}

export interface ReportFile {
    fileName: string;
    reportName: string;
    created: Date;
}