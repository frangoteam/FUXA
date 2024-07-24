import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, lastValueFrom } from 'rxjs';

import { EndPointApi } from '../_helpers/endpointapi';
import { environment } from '../../environments/environment';
import { Script, ScriptMode } from '../_models/script';
import { ProjectService } from './project.service';
import { HmiService, ScriptCommandEnum, ScriptCommandMessage } from './hmi.service';
import { Utils } from '../_helpers/utils';
import { DeviceType, TagDaq, TagDevice } from '../_models/device';
import { DaqQuery } from '../_models/hmi';

@Injectable({
    providedIn: 'root'
})
export class ScriptService {

    private endPointConfig: string = EndPointApi.getURL();

    constructor(private http: HttpClient,
                private projectService: ProjectService,
                private hmiService: HmiService,
            ) {

    }

    runScript(script: Script) {
        return new Observable((observer) => {
            if (!script.mode || script.mode == ScriptMode.SERVER) {
                if (environment.serverEnabled) {
                    let header = new HttpHeaders({ 'Content-Type': 'application/json' });
                    let params = { script: script };
                    this.http.post<any>(this.endPointConfig + '/api/runscript', { headers: header, params: params }).subscribe(result => {
                        observer.next(result);
                        observer.complete();
                    }, err => {
                        console.error(err);
                        observer.error(err);
                    });
                } else {
                    observer.next();
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
                    const asyncScript = `(async () => { ${this.addSysFunctions(code)} })();`;
                    const result = eval(asyncScript);
                    observer.next(result);
                } catch (err) {
                    console.error(err);
                    observer.error(err);
                }
                observer.complete();
            }
        });
    }

    evalScript(script: Script) {
        if (script.parameters?.length > 0) {
            console.warn('TODO: Script with mode CLIENT not work with parameters.');
        }
        try {
            const asyncScript = `(async () => { ${this.addSysFunctions(script.code)} })();`;
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
        code = code.replace(/\$enableDevice\(/g, 'this.$enableDevice(');
        code = code.replace(/\$getDeviceProperty\(/g, 'await this.$getDeviceProperty(');
        code = code.replace(/\$setDeviceProperty\(/g, 'await this.$setDeviceProperty(');
        code = code.replace(/\$invokeObject\(/g, 'this.$invokeObject(');
        code = code.replace(/\$runServerScript\(/g, 'this.$runServerScript(');
        code = code.replace(/\$getHistoricalTags\(/g, 'this.$getHistoricalTags(');
        return code;
    }

    public async $getTag(id: string) {
        let tag: TagDevice = this.projectService.getTagFromId(id, true);
        if (tag?.deviceType === DeviceType.internal) {
            return tag.value;
        }
        let values = await this.projectService.getTagsValues([id]);
        return values[0]?.value;
    }

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
        return await lastValueFrom(this.runScript(scriptToRun));
    }

    public async $getHistoricalTags(tagIds: string[], fromDate: number, toDate: number) {
        const query: DaqQuery = { sids: tagIds, from: fromDate, to: toDate };
        return await lastValueFrom(this.hmiService.getDaqValues(query));
    }
}
