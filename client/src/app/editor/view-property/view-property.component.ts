import { Component, Inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Utils } from '../../_helpers/utils';
import { Script } from '../../_models/script';
import { DocAlignType, DocProfile, ViewProperty, ViewType } from '../../_models/hmi';
import { TranslateService } from '@ngx-translate/core';
import { MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { AbstractControl, UntypedFormBuilder, UntypedFormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { GridType } from 'angular-gridster2';
import { FlexEventComponent } from '../../gauges/gauge-property/flex-event/flex-event.component';
import { ProjectService } from '../../_services/project.service';
import { Subject, startWith, takeUntil } from 'rxjs';
import { MatLegacyTab as MatTab } from '@angular/material/legacy-tabs';

@Component({
    selector: 'app-view-property',
    templateUrl: './view-property.component.html',
    styleUrls: ['./view-property.component.scss']
})
export class ViewPropertyComponent implements OnInit, OnDestroy {
    defaultColor = Utils.defaultColor;
    viewType = ViewType;
    alignType = DocAlignType;
    formGroup: UntypedFormGroup;
    gridType = GridType;
    scripts: Script[];
    private destroy$ = new Subject<void>();

    @ViewChild('flexevent', {static: false}) flexEvent: FlexEventComponent;
    @ViewChild('tabEvents', {static: true}) tabEvents: MatTab;

    propSizeType = [{ text: 'dlg.docproperty-size-320-240', value: { width: 320, height: 240 } }, { text: 'dlg.docproperty-size-460-360', value: { width: 460, height: 360 } },
    { text: 'dlg.docproperty-size-640-480', value: { width: 640, height: 480 } }, { text: 'dlg.docproperty-size-800-600', value: { width: 800, height: 600 } },
    { text: 'dlg.docproperty-size-1024-768', value: { width: 1024, height: 768 } }, { text: 'dlg.docproperty-size-1280-960', value: { width: 1280, height: 960 } },
    { text: 'dlg.docproperty-size-1600-1200', value: { width: 1600, height: 1200 } }, { text: 'dlg.docproperty-size-1920-1080', value: { width: 1920, height: 1080 } }];

    constructor(private fb: UntypedFormBuilder,
                private translateService: TranslateService,
                private projectService: ProjectService,
                public dialogRef: MatDialogRef<ViewPropertyComponent>,
                @Inject(MAT_DIALOG_DATA) public data: ViewPropertyType & { newView: boolean}) {

        this.scripts = this.projectService.getScripts();
        for (let i = 0; i < this.propSizeType.length; i++) {
            this.translateService.get(this.propSizeType[i].text).subscribe((txt: string) => { this.propSizeType[i].text = txt; });
        }
    }

    ngOnInit() {
        this.formGroup = this.fb.group({
            name: [{value: this.data.name, disabled: this.data.name}, Validators.required],
            type: [{value: this.data.type, disabled: this.data.name}],
            width: [this.data.profile.width],
            height: [this.data.profile.height],
            margin: [this.data.profile.margin],
            align: [this.data.profile.align],
            gridType: [this.data.profile.gridType],
            viewRenderDelay: [this.data.profile?.viewRenderDelay || 0],
        });
        if (this.data.type !== ViewType.cards && this.data.type !== ViewType.maps) {
            this.formGroup.controls.width.setValidators(Validators.required);
            this.formGroup.controls.height.setValidators(Validators.required);
        }
        if (!this.data.name) {
            this.formGroup.controls.name.addValidators(this.isValidName());
        }
        this.formGroup.updateValueAndValidity();

        this.formGroup.controls.type.valueChanges.pipe(
            takeUntil(this.destroy$),
            startWith(this.formGroup.controls.type.value)
        ).subscribe(type => {
            this.tabEvents.disabled = type === ViewType.cards || type === ViewType.maps;
            if (type === ViewType.cards && this.data.newView && this.data.profile.bkcolor === '#ffffffff') {
                this.data.profile.bkcolor = '#E6E6E6';
            }
        });
    }

    ngOnDestroy() {
        this.destroy$.next(null);
        this.destroy$.complete();
    }

    isValidName(): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            if (this.data.existingNames?.indexOf(control.value) !== -1) {
                return { name: this.translateService.instant('msg.view-name-exist') };
            }
            return null;
        };
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.data.name = this.formGroup.controls.name.value;
        this.data.type = this.formGroup.controls.type.value;
        this.data.profile.width = this.formGroup.controls.width.value;
        this.data.profile.height = this.formGroup.controls.height.value;
        this.data.profile.margin = this.formGroup.controls.margin.value;
        this.data.profile.align = this.formGroup.controls.align.value;
        this.data.profile.gridType = this.formGroup.controls.gridType.value;
        this.data.profile.viewRenderDelay = this.formGroup.controls.viewRenderDelay.value;
        if (!this.data.property) {
			this.data.property = new ViewProperty();
        }
        this.data.property.events = this.flexEvent.getEvents();
        this.dialogRef.close(this.data);
    }

    onSizeChange(size) {
        if (size?.width && size?.height) {
            this.formGroup.controls.height.setValue(size.height);
            this.formGroup.controls.width.setValue(size.width);
        }
    }

    onAddEvent() {
        this.flexEvent.onAddEvent();
    }
}

export interface ViewPropertyType {
    name: string;
    type: ViewType;
    profile: DocProfile;
    property: ViewProperty;
    existingNames?: string[];
}
