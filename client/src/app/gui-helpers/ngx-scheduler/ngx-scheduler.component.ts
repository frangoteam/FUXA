import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';

@Component({
    selector: 'app-ngx-scheduler',
    templateUrl: './ngx-scheduler.component.html',
    styleUrls: ['./ngx-scheduler.component.scss']
})
export class NgxSchedulerComponent implements OnInit {

    @Input() removable = true;
    @Input() formGroup: FormGroup;
    @Output() onRemove = new  EventEmitter<number>();

    selectedTabIndex: number = 0;
    selectedTabFormControl = new FormControl(this.selectedTabIndex);

    constructor(
      ) { }

    ngOnInit() {
        this.selectedTabIndex = this.formGroup.value.type;
    }

    onTabSelectionChange(event: number) {
        this.formGroup.controls.type.setValue(event);
    }

    onRemoveScheduling() {
        this.onRemove.emit();
    }

}
