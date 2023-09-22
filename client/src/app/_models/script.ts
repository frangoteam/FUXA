
export class Script {
    id: string;
    name: string;
    code: string;
    parameters: ScriptParam[] = [];
    scheduling: ScriptScheduling;
    permission: number;
    mode: ScriptMode = ScriptMode.SERVER;
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
    mode: ScriptSchedulingMode;
    interval: number;
}

export enum ScriptSchedulingMode {
    interval = 'interval',
    start = 'start',
    scheduling = 'scheduling',
}

export class SystemFunctions {
    functions = <SystemFunction[]>[{
        name: '$setTag', text: 'script.sys-fnc-settag-text', tooltip: 'script.sys-fnc-settag-tooltip', params: [true, false]
    },
    {
        name: '$getTag', text: 'script.sys-fnc-gettag-text', tooltip: 'script.sys-fnc-gettag-tooltip', params: [true]
    },
    {
        name: '$getTagId', text: 'script.sys-fnc-getTagId-text', tooltip: 'script.sys-fnc-getTagId-tooltip', params: [false], paramsText: 'script.sys-fnc-getTagId-params'
    },
    {
        name: '$setView', text: 'script.sys-fnc-setview-text', tooltip: 'script.sys-fnc-setview-tooltip', params: [false]
    },
    {
        name: '$enableDevice', text: 'script.sys-fnc-enableDevice-text', tooltip: 'script.sys-fnc-enableDevice-tooltip', params: [false, false], paramsText: 'script.sys-fnc-enableDevice-params'
    }];
}

export interface SystemFunction {
    name: string;       // javascript function defined in backend
    text: string;       // button text
    tooltip: string;    // description
    params: [boolean];  // array of function parameter where true is for tag and false for any (value)
    paramsText: string; // to add as parameter description in function
}

export enum ScriptMode {
    CLIENT = 'CLIENT',
    SERVER = 'SERVER',
}
