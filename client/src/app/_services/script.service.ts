import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { EndPointApi } from '../_helpers/endpointapi';
import { environment } from '../../environments/environment';
import { Script, ScriptMode } from '../_models/script';
import { ProjectService } from './project.service';
import { HmiService, ScriptCommandEnum, ScriptCommandMessage } from './hmi.service';

@Injectable({
    providedIn: 'root'
})
export class ScriptService {

    private endPointConfig: string = EndPointApi.getURL();

    constructor(private http: HttpClient,
                private projectService: ProjectService,
                private hmiService: HmiService) {

    }

    runScript(script: Script) {
        return new Observable((observer) => {
            if (!script.mode || script.mode == ScriptMode.SERVER) {
                if (environment.serverEnabled) {
                    let header = new HttpHeaders({ 'Content-Type': 'application/json' });
                    let params = { script: script };
                    this.http.post<any>(this.endPointConfig + '/api/runscript', { headers: header, params: params }).subscribe(result => {
                        observer.next(result);
                    }, err => {
                        console.error(err);
                        observer.error(err);
                    });
                } else {
                    observer.next();
                }
            } else {
                if (script.parameters?.length > 0) {
                    console.warn('TODO: Script with mode CLIENT not work with parameters.');
                }
                try {
                    const result = eval(this.addSysFunctions(script.code));
                    observer.next(result);
                } catch (err) {
                    console.error(err);
                    observer.error(err);
                }
            }
        });
    }

    evalScript(script: Script) {
        if (script.parameters?.length > 0) {
            console.warn('TODO: Script with mode CLIENT not work with parameters.');
        }
        try {
            eval(this.addSysFunctions(script.code));
        } catch (err) {
            console.error(err);
        }
    }

    private addSysFunctions(scriptCode: string): string {
        let code = scriptCode.replace(/\$getTag\(/g, 'this.$getTag(');
        code = code.replace(/\$setTag\(/g, 'this.$setTag(');
        code = code.replace(/\$getTagId\(/g, 'this.$getTagId(');
        code = code.replace(/\$setView\(/g, 'this.$setView(');
        code = code.replace(/\$enableDevice\(/g, 'this.$enableDevice(');
        return code;
    }

    public $getTag(id: string) {
        return this.projectService.getTagFromId(id)?.value;
    }

    public $setTag(id: string, value: any) {
        this.hmiService.putSignalValue(id, value);
    }

    public $getTagId(tagName: string, deviceName?: string) {
        return this.projectService.getTagIdFromName(tagName, deviceName);
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
}
