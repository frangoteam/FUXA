
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
    tagid = 'tagid',
    value = 'value',
    chart = 'chart'
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
    schedules: SchedulerData[];
}

export interface SchedulerData {
    date?: Date;
    days?: any[];
    time?: string;
    hour?: number;
    minute?: number;
    type?: SchedulerType;
}

export enum ScriptSchedulingMode {
    interval = 'interval',
    start = 'start',
    scheduling = 'scheduling',
}

export enum SchedulerType {
    weekly = 0,
    date = 1,
}

export class SystemFunctions {
    functions: SystemFunction[] = [];

    constructor(mode?: ScriptMode) {
        this.functions = this.allFunctions.filter(sf => !sf.mode || !mode || sf.mode === mode);
    }

    allFunctions = <SystemFunction[]>[{
        name: '$setTag',
        mode: null,
        text: 'script.sys-fnc-settag-text',
        tooltip: 'script.sys-fnc-settag-tooltip',
        params: [true, false]
    },
    {
        name: '$getTag',
        mode: null,
        text: 'script.sys-fnc-gettag-text',
        tooltip: 'script.sys-fnc-gettag-tooltip',
        params: [true]
    },
    {
        name: '$getTagId',
        mode: null,
        text: 'script.sys-fnc-getTagId-text',
        tooltip: 'script.sys-fnc-getTagId-tooltip',
        params: [false],
        paramsText: 'script.sys-fnc-getTagId-params'
    },
    {
        name: '$getTagDaqSettings',
        mode: null,
        text: 'script.sys-fnc-getTagDaqSettings-text',
        tooltip: 'script.sys-fnc-getTagDaqSettings-tooltip',
        params: [true],
        paramsText: 'script.sys-fnc-getTagDaqSettings-params'
    },
    {
        name: '$setTagDaqSettings',
        mode: null,
        text: 'script.sys-fnc-setTagDaqSettings-text',
        tooltip: 'script.sys-fnc-setTagDaqSettings-tooltip',
        params: [true, false],
        paramsText: 'script.sys-fnc-setTagDaqSettings-params'
    },
    {
        name: '$setView',
        mode: null,
        text: 'script.sys-fnc-setview-text',
        tooltip: 'script.sys-fnc-setview-tooltip',
        params: [false]
    },
    {
        name: '$enableDevice',
        mode: null,
        text: 'script.sys-fnc-enableDevice-text',
        tooltip: 'script.sys-fnc-enableDevice-tooltip',
        params: [false, false],
        paramsText: 'script.sys-fnc-enableDevice-params'
    },
    {
        name: '$getDeviceProperty',
        mode: null,
        text: 'script.sys-fnc-getDeviceProperty-text',
        tooltip: 'script.sys-fnc-getDeviceProperty-tooltip',
        params: [false],
        paramsText: 'script.sys-fnc-getDeviceProperty-params'
    },
    {
        name: '$setDeviceProperty',
        mode: null,
        text: 'script.sys-fnc-setDeviceProperty-text',
        tooltip: 'script.sys-fnc-setDeviceProperty-tooltip',
        params: [false, false],
        paramsText: 'script.sys-fnc-setDeviceProperty-params'
    },
    {
        name: '$getDevice',
        mode: ScriptMode.SERVER,
        text: 'script.sys-fnc-getDevice-text',
        tooltip: 'script.sys-fnc-getDevice-tooltip',
        params: [false, false],
        paramsText: 'script.sys-fnc-getDevice-params'
    },
    {
        name: '$invokeObject',
        mode: ScriptMode.CLIENT,
        text: 'script.sys-fnc-invokeObject-text',
        tooltip: 'script.sys-fnc-invokeObject-tooltip',
        params: [false, false, false],
        paramsText: 'script.sys-fnc-invokeObject-params'
    },
    {
        name: '$runServerScript',
        mode: ScriptMode.CLIENT,
        text: 'script.sys-fnc-runServerScript-text',
        tooltip: 'script.sys-fnc-runServerScript-tooltip',
        params: [false, false],
        paramsText: 'script.sys-fnc-runServerScript-params'
    },
    {
        name: '$getHistoricalTags',
        mode: null,
        text: 'script.sys-fnc-getHistoricalTag-text',
        tooltip:'script.sys-fnc-getHistoricalTag-tooltip',
        params:['array', false, false],
        paramsText: 'script.sys-fnc-getHistoricalTag-params',
        paramFilter: ScriptParamFilterType.history
    }
];
}

export class TemplatesCode {
    functions: SystemFunction[] = [];

    constructor(mode?: ScriptMode) {
        this.functions = this.allFunctions.filter(sf => !sf.mode || !mode || sf.mode === mode);
    }
    allFunctions = <SystemFunction[]>[{
        name: 'chart-data', mode: ScriptMode.CLIENT, text: 'script.template-chart-data-text', tooltip: 'script.template-chart-data-tooltip',
        code: `if (paramLines && Array.isArray(paramLines)) {
    const count = 10;
    paramLines.forEach(line => {
        var y = [];
        var x = [];
        for (var i = 0; i < count; i++) {
            const randomNumber = Math.floor(Math.random() * 21);
            y.push(randomNumber);
            x.push(i);
        }
        line['y'] = y;
        line['x'] = x;
    });
    return paramLines;
} else {
    return 'Missing chart lines';
}`
    },
    {
        name: 'invoke-chart-update-options', mode: ScriptMode.CLIENT, text: 'script.template-invoke-chart-update-options-text', tooltip: 'script.template-invoke-chart-update-options-tooltip',
        code: `let opt = $invokeObject('chart_1', 'getOptions');
if (opt) {
    opt.scaleY1min = 100;
    opt.scaleY1max = 200;
}
$invokeObject('chart_1', 'updateOptions', opt);`
    }];
}

export interface SystemFunction {
    name: string;           // javascript function defined in backend
    text: string;           // button text
    tooltip: string;        // description
    params?: [boolean | string];     // array of function parameter where true is for tag and false for any (value)
    paramsText?: string;    // to add as parameter description in function
    code?: string;          // Code to paste
    mode?: ScriptMode;
    paramFilter?: ScriptParamFilterType;
}

export enum ScriptMode {
    CLIENT = 'CLIENT',
    SERVER = 'SERVER',
}

export enum ScriptParamFilterType {
    history = 'history'
}
