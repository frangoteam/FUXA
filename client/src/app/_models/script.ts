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
}

export enum ScriptParamType {
    tagid = 'script.paramtype-tagid',
    value = 'script.paramtype-value',
}

export const SCRIPT_PREFIX = 's_';
