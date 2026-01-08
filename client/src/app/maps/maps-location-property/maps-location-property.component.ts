import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { AbstractControl, UntypedFormBuilder, UntypedFormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA as MAT_DIALOG_DATA, MatDialogRef as MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { ProjectService } from '../../_services/project.service';
import { MapsLocation, MAPSLOCATION_PREFIX } from '../../_models/maps';
import { Utils } from '../../_helpers/utils';
import { GaugeAction, GaugeRangeProperty, View, ViewType } from '../../_models/hmi';
import { BehaviorSubject, combineLatest, map, Observable, of } from 'rxjs';
import { Define } from '../../_helpers/define';
import { FlexDeviceTagValueType } from '../../gauges/gauge-property/flex-device-tag/flex-device-tag.component';
import { FlexActionsStandaloneComponent } from '../../gauges/gauge-property/flex-actions-standalone/flex-actions-standalone.component';

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
    filteredIcons$: Observable<string[]>;
    filterText = '';
    private filterTextSubject = new BehaviorSubject<string>('');
    icons$: Observable<string[]>;
    defaultColor = Utils.defaultColor;
    @ViewChild('flexActionsStandalone', { static: false }) flexActionsStandalone: FlexActionsStandaloneComponent;

    constructor(
        public dialogRef: MatDialogRef<MapsLocationPropertyComponent>,
        private fb: UntypedFormBuilder,
        private translateService: TranslateService,
        private projectService: ProjectService,
        @Inject(MAT_DIALOG_DATA) public data: MapsLocation) {
            this.location = this.data ?? new MapsLocation(Utils.getGUID(MAPSLOCATION_PREFIX));

        this.icons$ = of(Define.MaterialIconsRegular).pipe(
            map((data: string) => data.split('\n')),
            map(lines => lines.map(line => line.split(' ')[0])),
            map(names => names.filter(name => !!name))
        );

        this.filteredIcons$ = combineLatest([
            this.icons$,
            this.filterTextSubject.asObservable()
        ]).pipe(
            map(([icons, filterText]) =>
                icons.filter(icon => icon.toLowerCase().includes(filterText.toLowerCase()))
            )
        );
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

    onFilterChange() {
        this.filterTextSubject.next(this.filterText);
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
