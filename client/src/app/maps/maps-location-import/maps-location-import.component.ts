import { Component, Inject, OnInit } from '@angular/core';
import { MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { ProjectService } from '../../_services/project.service';
import { MapsLocation } from '../../_models/maps';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { map, Observable, startWith } from 'rxjs';

@Component({
    selector: 'app-maps-location-import',
    templateUrl: './maps-location-import.component.html',
    styleUrls: ['./maps-location-import.component.scss']
})
export class MapsLocationImportComponent implements OnInit {
    formGroup: FormGroup;
    locationFilter = new FormControl('');
    locations$: Observable<MapsLocation[]>;
    allLocations: MapsLocation[] = [];

    constructor(
        public dialogRef: MatDialogRef<MapsLocationImportComponent>,
        private projectService: ProjectService,
        @Inject(MAT_DIALOG_DATA) public data: MapsLocation[]
    ) {
        this.formGroup = new FormGroup({
            location: new FormControl(null, [Validators.required, this.locationValidator.bind(this)])
        });
    }

    ngOnInit() {
        this.allLocations = this.projectService.getMapsLocations()?.filter(location => !this.data?.some(d => d.id === location.id));
        this.locations$ = this.formGroup.get('location')!.valueChanges.pipe(
            startWith(''),
            map(value => this._filterLocations(value || ''))
        );
    }

    private _filterLocations(value: string | MapsLocation): MapsLocation[] {
        let filterValue: string = '';
        if (typeof value === 'string') {
            filterValue = value.toLowerCase();
        } else if (value && value.name) {
            filterValue = value.name.toLowerCase();
        }
        return this.allLocations.filter(location =>
            location.name.toLowerCase().includes(filterValue)
        );
    }

    displayFn(location?: MapsLocation): string {
        return location ? location.name : '';
    }

    locationValidator(control: FormControl) {
        const selectedLocation = control.value;
        if (selectedLocation && typeof selectedLocation === 'object' && selectedLocation.id) {
            return null;
        }

        if (typeof selectedLocation === 'string') {
            const match = this.allLocations.find(loc => loc.name.toLowerCase() === selectedLocation.toLowerCase());
            return match ? null : { invalidLocation: true };
        }
        return { invalidLocation: true };
    }

    onLocationSelected(location: MapsLocation) {
        this.formGroup.get('location')!.setValue(location);
        this.formGroup.get('location')!.updateValueAndValidity();
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        const selectedLocation = this.formGroup.get('location')!.value;
        let location: MapsLocation | undefined;
        if (selectedLocation && typeof selectedLocation === 'object' && selectedLocation.id) {
            location = selectedLocation;
        } else if (typeof selectedLocation === 'string') {
            location = this.allLocations.find(loc => loc.name === selectedLocation);
        }
        if (location) {
            this.dialogRef.close(location);
        }
    }
}
