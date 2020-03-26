export class User {
    username: string;
    password: string;
    groups: number;
}

export class UserGroups {
    static ADMINMASK = [-1, 255];
    static EXTENSION = 8;
    static Groups = [{id: 1, label: 'A'},
            {id: 2, label: 'B'},
            {id: 4, label: 'C'},
            {id: 8, label: 'D'},
            {id: 16, label: 'E'},
            {id: 32, label: 'F'},
            {id: 64, label: 'G'},
            {id: 128, label: 'H'}];

    static GroupsToValue (grps: any, extended?: boolean): number {
        let result = 0;
        if (grps) {
            for (let i = 0; i < grps.length; i++) {
                result += grps[i].id;
            }
        } 
        let shift = (extended) ? this.EXTENSION : 0;
        return result << shift;
    }

    static ValueToGroups(value: number, extended?: boolean): any {
        let result = [];
        let shift = (extended) ? this.EXTENSION : 0;
        for (let i = 0; i < this.Groups.length; i++) {
            if ((value >> shift) & this.Groups[i].id) {
                result.push(this.Groups[i]);
            }
        }
        return result;
    }

    static GroupToLabel(value: number): string {
        let result = '';
        for (let i = 0; i < this.Groups.length; i++) {
            if (value & this.Groups[i].id) {
                if (result) {
                    result += ',';
                }
                result += this.Groups[i].label;
            }
        }
        return result;
    }
}