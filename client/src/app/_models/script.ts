export class Script {
    id: string;
    name: string;
    receiver: string;
    delay: number = 1;
    interval: number = 0;
    enabled: boolean = true;
    text: string;
    type: string;
    subscriptions = {};
    options: any;

    constructor(_id: string) {
        this.id = _id;
    }    
}

export const SCRIPT_PREFIX = 's_';
