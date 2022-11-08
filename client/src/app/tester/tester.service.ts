
import { Injectable, Output, EventEmitter } from '@angular/core';

@Injectable()
export class TesterService {

    @Output() change: EventEmitter<boolean> = new EventEmitter();

    toggle(flag: boolean) {
        this.change.emit(flag);
    }
}
