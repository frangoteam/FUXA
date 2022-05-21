import { expand } from "rxjs/operators";

export class Script {
    id: string;
    name: string;
    code: string;
    parameters: ScriptParam[] = [];
    scheduling: ScriptScheduling;
    permission: number;
    constructor(_id: string) {
        this.id = _id;
    }    
}

export class ScriptTest extends Script {
    test = true;
    outputId: string;           // to filter the console output sended from backend script runner

    constructor(_id: string, _name: string) {
        super(_id);
        this.name = _name;
    }
}

export class ScriptParam {
    name: string;
    type: ScriptParamType;
    value: any;

    constructor(_name: string, _type: ScriptParamType) {
        this.name = _name;
        this.type = _type;
    }
}

export enum ScriptParamType {
    tagid = 'script.paramtype-tagid',
    value = 'script.paramtype-value',
}

export const SCRIPT_PREFIX = 's_';
export const SCRIPT_PARAMS_MAP = 'params';

export interface ScriptConsoleMessage {
    msg: string;
    type: string;
    id: string;
}

export interface ScriptScheduling {
    interval: number;
}

export class SystemFunctions {    
    functions = <SystemFunction[]>[{
        name: '$setTag', text: 'script.sys-fnc-settag-text', tooltip: 'script.sys-fnc-settag-tooltip', params: [true, false]
    },
    {
        name: '$getTag', text: 'script.sys-fnc-gettag-text', tooltip: 'script.sys-fnc-gettag-tooltip', params: [true]
    }];
}

export interface SystemFunction {
    name: string,       // javascript function defined in backend
    text: string,       // button text
    tooltip: string;    // description
    params: [boolean],  // array of function parameter where true is for tag and false for any (value)
}