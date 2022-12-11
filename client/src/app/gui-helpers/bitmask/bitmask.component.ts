import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
    selector: 'app-bitmask',
    templateUrl: './bitmask.component.html',
    styleUrls: ['./bitmask.component.css']
})
export class BitmaskComponent implements OnInit {

    size = 32;
    bits: Bit[] = [];
    selected: Bit[] = [];

    constructor(public dialogRef: MatDialogRef<BitmaskComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any) { }

    ngOnInit() {
        this.size = this.data.size || 32;
        for (let i = 0; i < this.size; i++) {
            let bit = <Bit>{id: Math.pow(2, i), label: (i).toString()};
            this.bits.push(bit);
            if (this.data.bitmask & bit.id) {
                this.selected.push(bit);
            }
        }
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        let result = { bitmask: this.getValue() };
        this.dialogRef.close(result);
    }

    getValue(): number {
        let result = 0;
        for (let i = 0; i < this.selected.length; i++) {
            result += this.selected[i].id;
        }
        return result;
    }
}

export class Bit {
    public id: number;
    public label: string;
    public selected: boolean;
}
