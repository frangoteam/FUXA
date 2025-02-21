import { Component, Inject, OnInit } from '@angular/core';
import { AbstractControl, UntypedFormBuilder, UntypedFormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { TranslateService } from '@ngx-translate/core';
import { ProjectService } from '../../_services/project.service';
import { MapsLocation, MAPSLOCATION_PREFIX } from '../../_models/maps';
import { Utils } from '../../_helpers/utils';
import { View, ViewType } from '../../_models/hmi';

@Component({
    selector: 'app-maps-location-property',
    templateUrl: './maps-location-property.component.html',
    styleUrls: ['./maps-location-property.component.scss']
})
export class MapsLocationPropertyComponent implements OnInit {

    location: MapsLocation;
    formGroup: UntypedFormGroup;
    views: View[] = [];

    constructor(
        public dialogRef: MatDialogRef<MapsLocationPropertyComponent>,
        private fb: UntypedFormBuilder,
        private translateService: TranslateService,
        private projectService: ProjectService,
        @Inject(MAT_DIALOG_DATA) public data: MapsLocation) {
            this.location = this.data ?? new MapsLocation(Utils.getGUID(MAPSLOCATION_PREFIX));
    }

    ngOnInit() {
        this.views = this.projectService.getViews()?.filter(view => view.type !== ViewType.maps);
        this.formGroup = this.fb.group({
            name: [this.location.name, Validators.required],
            latitude: [this.location.latitude],
            longitude: [this.location.longitude],
            viewId: [this.location.viewId],
            pageId: [this.location.pageId],
            url: [this.location.url],
            description: [this.location.description],
        });
        this.formGroup.controls.name.addValidators(this.isValidName());
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.location = {...this.location, ...this.formGroup.getRawValue()};
        this.dialogRef.close(this.location);
    }

    isValidName(): ValidatorFn {
        const names = this.projectService.getMapsLocations().map(ml => ml.name);
        return (control: AbstractControl): ValidationErrors | null => {
            if (this.location?.name === control.value) {
                return null;
            }
            if (names?.indexOf(control.value) !== -1) {
                return { name: this.translateService.instant('msg.maps-location-name-exist') };
            }
            return null;
        };
    }
}
