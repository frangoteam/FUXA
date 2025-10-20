import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatLegacyTable as MatTable, MatLegacyTableDataSource as MatTableDataSource } from '@angular/material/legacy-table';
import { MatLegacyDialog as MatDialog} from '@angular/material/legacy-dialog';
import { ConfirmDialogComponent } from '../../gui-helpers/confirm-dialog/confirm-dialog.component';
import { TranslateService } from '@ngx-translate/core';
import { MapsLocation } from '../../_models/maps';
import { ProjectService } from '../../_services/project.service';
import { Subject, takeUntil } from 'rxjs';
import { MatSort } from '@angular/material/sort';
import { MapsLocationPropertyComponent } from '../maps-location-property/maps-location-property.component';

@Component({
    selector: 'app-maps-location-list',
    templateUrl: './maps-location-list.component.html',
    styleUrls: ['./maps-location-list.component.scss']
})
export class MapsLocationListComponent implements OnInit, AfterViewInit, OnDestroy {

    displayedColumns = ['select', 'name', 'view', 'description', 'remove'];
    dataSource = new MatTableDataSource([]);

	locations: MapsLocation[];
    viewNameMap: { [key: string]: string } = {};
    private destroy$ = new Subject<void>();

    @ViewChild(MatTable, {static: true}) table: MatTable<any>;
    @ViewChild(MatSort, {static: false}) sort: MatSort;

    constructor(private dialog: MatDialog,
                private translateService: TranslateService,
                private projectService: ProjectService) { }

    ngOnInit() {
        this.loadLocations();
        this.projectService.onLoadHmi.pipe(
            takeUntil(this.destroy$)
        ).subscribe(_ => {
            this.loadLocations();
        });
    }

    ngAfterViewInit() {
        this.dataSource.sort = this.sort;
    }

    ngOnDestroy() {
        this.destroy$.next(null);
        this.destroy$.complete();
    }

    onAddLocation() {
		this.editLocation();
	}

    onEditLocation(location: MapsLocation) {
		this.editLocation(location);
	}

    onRemoveLocation(location: MapsLocation) {
        let msg = this.translateService.instant('msg.maps-location-remove', { value: location.name });
        let dialogRef = this.dialog.open(ConfirmDialogComponent, {
            data: { msg: msg },
            position: { top: '60px' }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result && location) {
                this.projectService.removeMapsLocation(location).subscribe(result => {
                    this.loadLocations();
                }, err => {
			        console.error('remove Locations err: ' + err);
                });
            }
        });
	}

    getViewName(viewId: string) {
        return this.viewNameMap[viewId];
    }

    private loadLocations() {
        this.viewNameMap = this.projectService.getViews().reduce((acc, obj) => {
            acc[obj.id] = obj.name;
            return acc;
        }, {} as { [key: string]: string });
        this.dataSource.data = this.projectService.getMapsLocations();
    }

    private editLocation(location?: MapsLocation) {
		let dialogRef = this.dialog.open(MapsLocationPropertyComponent, {
			position: { top: '60px' },
            disableClose: true,
            data: location,
		});
		dialogRef.afterClosed().subscribe(result => {
			if (result) {
                this.projectService.setMapsLocation(result, location).subscribe(() => {
                    this.loadLocations();
                });
			}
		});
	}
}
