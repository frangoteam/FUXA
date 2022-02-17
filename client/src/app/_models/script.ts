import { expand } from "rxjs/operators";

export class Script {
    id: string;
    name: string;
    code: string;
    parameters: ScriptParam[] = [];

    constructor(_id: string) {
        this.id = _id;
    }    
}

export class ScriptParam {
    name: string;
    type: ScriptParamType;

    constructor(_name: string, _type: ScriptParamType) {
        this.name = _name;
        this.type = _type;
    }
}

export class ScriptTestParam extends ScriptParam {
    value: any;
}

export enum ScriptParamType {
    tagid = 'script.paramtype-tagid',
    value = 'script.paramtype-value',
}

export const SCRIPT_PREFIX = 's_';

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