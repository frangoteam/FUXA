import { ChangeDetectorRef, Component, Inject, OnInit, ViewChild } from '@angular/core';
import { AbstractControl, UntypedFormBuilder, UntypedFormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA as MAT_DIALOG_DATA, MatDialogRef as MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { ProjectService } from '../../_services/project.service';
import { MapsLocation, MAPSLOCATION_PREFIX } from '../../_models/maps';
import { Utils } from '../../_helpers/utils';
import { GaugeAction, GaugeRangeProperty, View, ViewType } from '../../_models/hmi';
import { FlexDeviceTagValueType } from '../../gauges/gauge-property/flex-device-tag/flex-device-tag.component';
import { FlexActionsStandaloneComponent } from '../../gauges/gauge-property/flex-actions-standalone/flex-actions-standalone.component';
import { UploadFile } from '../../_models/project';

@Component({
    selector: 'app-maps-location-property',
    templateUrl: './maps-location-property.component.html',
    styleUrls: ['./maps-location-property.component.scss']
})
export class MapsLocationPropertyComponent implements OnInit {

    location: MapsLocation;
    formGroup: UntypedFormGroup;
    views: View[] = [];
    actions: GaugeAction[] = [];
    defaultColor = Utils.defaultColor;
    @ViewChild('flexActionsStandalone', { static: false }) flexActionsStandalone: FlexActionsStandaloneComponent;

    constructor(
        public dialogRef: MatDialogRef<MapsLocationPropertyComponent>,
        private fb: UntypedFormBuilder,
        private translateService: TranslateService,
        private projectService: ProjectService,
        private cdr: ChangeDetectorRef,
        @Inject(MAT_DIALOG_DATA) public data: MapsLocation) {
            this.location = this.data ?? new MapsLocation(Utils.getGUID(MAPSLOCATION_PREFIX));
    }

    ngOnInit() {
        this.views = this.projectService.getViews()?.filter(view => view.type !== ViewType.maps);
        this.actions = Utils.clone(this.location.actions || []);
        this.formGroup = this.fb.group({
            name: [this.location.name, Validators.required],
            latitude: [this.location.latitude],
            longitude: [this.location.longitude],
            viewId: [this.location.viewId],
            pageId: [this.location.pageId],
            url: [this.location.url],
            description: [this.location.description],
            showMarkerName: [this.location.showMarkerName],
            showMarkerIcon: [this.location.showMarkerIcon],
            showMarkerValue: [this.location.showMarkerValue],
            markerIcon: [this.location.markerIcon],
            markerImage: [this.location.markerImage],
            markerBackground: [this.location.markerBackground ?? '#ffffff'],
            markerColor: [this.location.markerColor ?? '#000000'],
            markerTagValueId: [this.location.markerTagValueId]
        });
        this.formGroup.controls.name.addValidators(this.isValidName());
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        const actions = this.flexActionsStandalone?.getActions() || [];
        this.location = {...this.location, ...this.formGroup.getRawValue(), actions };
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

    onMarkerIconSelected() {
        this.formGroup.get('markerImage')?.setValue('');
    }

    onSetMarkerImage(event) {
        if (event.target.files) {
            let filename = event.target.files[0].name;
            let fileToUpload = { type: filename.split('.').pop().toLowerCase(), name: filename.split('/').pop(), data: null };
            let reader = new FileReader();
            reader.onload = () => {
                try {
                    fileToUpload.data = reader.result;
                    this.projectService.uploadFile(fileToUpload).subscribe((result: UploadFile) => {
                        this.formGroup.get('markerImage')?.setValue(result.location);
                        this.formGroup.get('markerIcon')?.setValue('image');
                        this.cdr.detectChanges();
                    });
                } catch (err) {
                    console.error(err);
                }
            };
            if (fileToUpload.type === 'svg') {
                reader.readAsText(event.target.files[0]);
            } else {
                reader.readAsDataURL(event.target.files[0]);
            }
        }
    }

    onTagChanged(tag: FlexDeviceTagValueType) {
        this.formGroup.get('markerTagValueId')?.setValue(tag.variableId);
    }

    onAddAction() {
        const ga = new GaugeAction();
        ga.range = new GaugeRangeProperty();
        this.actions.push(ga);
    }
}
