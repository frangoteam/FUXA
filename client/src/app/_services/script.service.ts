import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, lastValueFrom } from 'rxjs';

import { EndPointApi } from '../_helpers/endpointapi';
import { environment } from '../../environments/environment';
import { Script, ScriptMode, SystemFunctions } from '../_models/script';
import { ProjectService } from './project.service';
import { HmiService, ScriptCommandEnum, ScriptCommandMessage } from './hmi.service';
import { Utils } from '../_helpers/utils';
import { DeviceType, TagDaq, TagDevice } from '../_models/device';
import { DaqQuery } from '../_models/hmi';
import { AlarmsType } from '../_models/alarm';
import { ToastNotifierService } from './toast-notifier.service';
import { AuthService } from './auth.service';
import { DeviceAdapterService } from '../device-adapter/device-adapter.service';

@Injectable({
    providedIn: 'root'
})
export class ScriptService {

    private endPointConfig: string = EndPointApi.getURL();

    constructor(private http: HttpClient,
        private projectService: ProjectService,
        private hmiService: HmiService,
        private authService: AuthService,
        private deviceAdapaterService: DeviceAdapterService,
        private toastNotifier: ToastNotifierService
    ) {
        this.projectService.onLoadClientAccess.subscribe(() => {
            this.loadScriptApi();
        });
        this.projectService.onLoadHmi.subscribe(() => {
            this.loadScriptApi();
        });
    }

    loadScriptApi() {
        const clientAccess = this.projectService.getClientAccess();
        const systemFunctions = new SystemFunctions(ScriptMode.CLIENT);
        const api: any = {};

        for (const fn of systemFunctions.functions) {
            if (clientAccess.scriptSystemFunctions.includes(fn.name)) {
                const methodName = fn.name.replace('$', '');
                if (typeof this[fn.name] === 'function') {
                    api[methodName] = this[fn.name].bind(this);
                } else {
                    console.warn(`Function ${fn.name} not found in ScriptService`);
                }
            }
        }
        (window as any).fuxaScriptAPI = api;
    }

    runScript(script: Script, toLogEvent: boolean = true): Observable<any> {
        return new Observable((observer) => {
            const permission = this.authService.checkPermission(script, true);
            if (permission?.enabled === false) {
                this.toastNotifier.notifyError('msg.operation-unauthorized', '', false, false);
                observer.next(null);
                observer.complete();
                return;
            }
            if (!script.mode || script.mode === ScriptMode.SERVER) {
                if (environment.serverEnabled) {
                    let header = new HttpHeaders({ 'Content-Type': 'application/json' });
                    let params = { script: script, toLogEvent: toLogEvent };
                    this.http.post<any>(this.endPointConfig + '/api/runscript', { headers: header, params: params }).subscribe(result => {
                        observer.next(result);
                        observer.complete();
                    }, err => {
                        console.error(err);
                        observer.error(err);
                    });
                } else {
                    observer.next(null);
                    observer.complete();
                }
            } else {
                let parameterToAdd = '';
                script.parameters?.forEach(param => {
                    if (Utils.isNumeric(param.value)) {
                        parameterToAdd += `let ${param.name} = ${param.value};`;
                    } else if (Utils.isObject(param.value)) {
                        parameterToAdd += `let ${param.name} = ${JSON.stringify(param.value)};`;
                    } else {
                        parameterToAdd += `let ${param.name} = '${param.value}';`;
                    }
                });
                try {
                    const code = `${parameterToAdd}${script.code}`;
                    const asyncText = script.sync ? 'function' : 'async function';
                    const callText = `${asyncText} ${script.name}() {\n${this.addSysFunctions(code)} \n }\n${script.name}.call(this);\n`;
                    const result = eval(callText);
                    observer.next(result);
                } catch (err) {
                    console.error(err);
                    observer.error(err);
                } finally {
                    observer.complete();
                }
            }
        });
    }

    evalScript(script: Script) {
        if (script.parameters?.length > 0) {
            console.warn('TODO: Script with mode CLIENT not work with parameters.');
        }
        try {
            const asyncText = script.sync ? '' : 'async';
            const asyncScript = `(${asyncText} () => { ${this.addSysFunctions(script.code)} \n})();`;
            eval(asyncScript);
        } catch (err) {
            console.error(err);
        }
    }

    private addSysFunctions(scriptCode: string): string {
        let code = scriptCode.replace(/\$getTag\(/g, 'await this.$getTag(');
        code = code.replace(/\$setTag\(/g, 'this.$setTag(');
        code = code.replace(/\$getTagId\(/g, 'this.$getTagId(');
        code = code.replace(/\$getTagDaqSettings\(/g, 'await this.$getTagDaqSettings(');
        code = code.replace(/\$setTagDaqSettings\(/g, 'await this.$setTagDaqSettings(');
        code = code.replace(/\$setView\(/g, 'this.$setView(');
        code = code.replace(/\$openCard\(/g, 'this.$openCard(');
        code = code.replace(/\$enableDevice\(/g, 'this.$enableDevice(');
        code = code.replace(/\$getDeviceProperty\(/g, 'await this.$getDeviceProperty(');
        code = code.replace(/\$setDeviceProperty\(/g, 'await this.$setDeviceProperty(');
        code = code.replace(/\$setAdapterToDevice\(/g, 'this.$setAdapterToDevice(');
        code = code.replace(/\$resolveAdapterTagId\(/g, 'this.$resolveAdapterTagId(');
        code = code.replace(/\$invokeObject\(/g, 'this.$invokeObject(');
        code = code.replace(/\$runServerScript\(/g, 'this.$runServerScript(');
        code = code.replace(/\$getHistoricalTags\(/g, 'this.$getHistoricalTags(');
        code = code.replace(/\$sendMessage\(/g, 'this.$sendMessage(');
        code = code.replace(/\$getAlarms\(/g, 'await this.$getAlarms(');
        code = code.replace(/\$getAlarmsHistory\(/g, 'await this.$getAlarmsHistory(');
        code = code.replace(/\$ackAlarm\(/g, 'await this.$ackAlarm(');
        return code;
    }

    /* get Tag value from server, check authorization of source script */
    public async $getTag(id: string) {
        let tag: TagDevice = this.projectService.getTagFromId(id, true);
        if (tag?.deviceType === DeviceType.internal) {
            return tag.value;
        }
        const sourceScriptName = this.extractUserFunctionBeforeScriptService();
        let values = await this.projectService.getTagsValues([id], sourceScriptName);
        return values[0]?.value;
    }

    /* set Tag value to server via socket */
    public $setTag(id: string, value: any) {
        this.hmiService.putSignalValue(id, value);
    }

    public $getTagId(tagName: string, deviceName?: string) {
        return this.projectService.getTagIdFromName(tagName, deviceName);
    }

    public async $getTagDaqSettings(id: string) {
        let daqSettings = await this.projectService.runSysFunctionSync('$getTagDaqSettings', [id]);
        return daqSettings;
    }

    public async $setTagDaqSettings(id: string, daq: TagDaq) {
        return await this.projectService.runSysFunctionSync('$setTagDaqSettings', [id, daq]);
    }

    public $setView(viewName: string, force?: boolean) {
        this.hmiService.onScriptCommand(<ScriptCommandMessage>{
            command: ScriptCommandEnum.SETVIEW,
            params: [viewName, force]
        });
    }

    public $openCard(viewName: string, options?: {}) {
        this.hmiService.onScriptCommand(<ScriptCommandMessage>{
            command: ScriptCommandEnum.OPENCARD,
            params: [viewName, options]
        });
    }

    public $enableDevice(deviceName: string, enable: boolean) {
        this.hmiService.deviceEnable(deviceName, enable);
    }

    public async $getDeviceProperty(deviceName: string) {
        let daqSettings = await this.projectService.runSysFunctionSync('$getDeviceProperty', [deviceName]);
        return daqSettings;
    }

    public async $setDeviceProperty(deviceName: string, property: any) {
        return await this.projectService.runSysFunctionSync('$setDeviceProperty', [deviceName, property]);
    }

    public async $setAdapterToDevice(adapterName: string, deviceName: string) {
        return await this.deviceAdapaterService.setTargetDevice(adapterName, deviceName, this.hmiService.initSignalValues.bind(this.hmiService));
    }

    public $resolveAdapterTagId(id: string): string {
        let tagIdOfDevice = this.deviceAdapaterService.resolveAdapterTagsId([id]);
        if (tagIdOfDevice?.length && tagIdOfDevice[0] !== id) {
            return tagIdOfDevice[0];
        }
        return id;
    }

    public $invokeObject(gaugeName: string, fncName: string, ...params: any[]) {
        const gauge = this.hmiService.getGaugeMapped(gaugeName);
        if (gauge[fncName]) {
            return gauge[fncName](...params);
        }
        return null;
    }

    public async $runServerScript(scriptName: string, ...params: any[]) {
        let scriptToRun = Utils.clone(this.projectService.getScripts().find(dataScript => dataScript.name == scriptName));
        scriptToRun.parameters = params;
        return await lastValueFrom(this.runScript(scriptToRun, false));
    }

    public async $getHistoricalTags(tagIds: string[], fromDate: number, toDate: number) {
        const query: DaqQuery = { sids: tagIds, from: fromDate, to: toDate };
        return await lastValueFrom(this.hmiService.getDaqValues(query));
    }

    public async $sendMessage(to: string, subject: string, message: string) {
        return await this.projectService.runSysFunctionSync('$sendMessage', [to, subject, message]);
    }

    public async $getAlarms() {
        return await this.projectService.runSysFunctionSync('$getAlarms', null);
    }

    public async $getAlarmsHistory(from: Date, to: Date) {
        return await this.projectService.runSysFunctionSync('$getAlarmsHistory', [from, to]);
    }

    public async $ackAlarm(alarmName: string, types?: AlarmsType[]) {
        return await this.projectService.runSysFunctionSync('$ackAlarm', [alarmName, types]);
    }

    private extractUserFunctionBeforeScriptService(): string | null {
        const err = new Error();
        const lines = err.stack?.match(/at\s[^\n]+/g);
        if (!lines) {
            return null;
        }

        for (const line of lines) {
            const match = line.match(/ScriptService\.([\w$]+) \(eval at/);
            if (match) {
                return match[1];
            }
        }

        return null;
    }
}
