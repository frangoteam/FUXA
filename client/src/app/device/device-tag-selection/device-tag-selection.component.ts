import { AfterViewInit, Component, OnInit, ViewChild, Inject } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { Device, DeviceType, Tag } from '../../_models/device';
import { ProjectService } from '../../_services/project.service';

@Component({
    selector: 'app-device-tag-selection',
    templateUrl: './device-tag-selection.component.html',
    styleUrls: ['./device-tag-selection.component.scss']
})
export class DeviceTagSelectionComponent implements OnInit, AfterViewInit {

    @ViewChild(MatTable, { static: false }) table: MatTable<any>;
    @ViewChild(MatSort, { static: false }) sort: MatSort;
    @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;

    dataSource = new MatTableDataSource([]);
    nameFilter = new UntypedFormControl();
    addressFilter = new UntypedFormControl();
    deviceFilter = new UntypedFormControl();
    tags: TagElement[] = [];
    devices: Device[] = [];
    filteredValues = {
        name: '', address: '', device: ''
    };

    readonly defColumns = ['toogle', 'name', 'address', 'device', 'select'];

    constructor(public dialogRef: MatDialogRef<DeviceTagSelectionComponent>,
        private projectService: ProjectService,
        @Inject(MAT_DIALOG_DATA) public data: DeviceTagSelectionData) {
        this.loadDevicesTags();
    }

    ngOnInit() {

        this.nameFilter.valueChanges.subscribe((nameFilterValue) => {
            this.filteredValues['name'] = nameFilterValue;
            this.dataSource.filter = JSON.stringify(this.filteredValues);
        });

        this.addressFilter.valueChanges.subscribe((addressFilterValue) => {
            this.filteredValues['address'] = addressFilterValue;
            this.dataSource.filter = JSON.stringify(this.filteredValues);
        });

        this.deviceFilter.valueChanges.subscribe((deviceFilterValue) => {
            this.filteredValues['device'] = deviceFilterValue;
            this.dataSource.filter = JSON.stringify(this.filteredValues);
        });
        this.dataSource.filterPredicate = this.customFilterPredicate();
    }

    customFilterPredicate() {
        const myFilterPredicate = (data: TagElement, filter: string): boolean => {
            let searchString = JSON.parse(filter);
            return (!data.name || data.name.toString().trim().toLowerCase().indexOf(searchString.name.toLowerCase()) !== -1) &&
                (!data.address || data.address.toString().trim().toLowerCase().indexOf(searchString.address.toLowerCase()) !== -1) &&
                data.device.toString().trim().toLowerCase().indexOf(searchString.device.toLowerCase()) !== -1;
        };
        return myFilterPredicate;
    }

    ngAfterViewInit() {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
        // this.dataSource.data = this.data.tags;
    }

    onToogle(element: TagElement) {
        if (element.checked && !this.data.multiSelection) {
            this.dataSource.data.forEach(e => {
                if (e.id !== element.id) {
                    e.checked = false;
                }
            });
        }
    }

    onClearSelection() {
        this.dataSource.data.forEach(e => {
            e.checked = false;
        });
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.data.variableId = null;
        this.data.variablesId = [];
        this.dataSource.data.forEach(e => {
            if (e.checked) {
                this.data.variableId = e.id;
                this.data.variablesId.push(e.id);
            }
        });
        this.dialogRef.close(this.data);
    }

    onSelect(element: TagElement) {
        this.data.variableId = element.id;
        this.dialogRef.close(this.data);
    }

    private loadDevicesTags() {
        this.devices = Object.values(this.projectService.getDevices());
        if (this.devices) {
            this.devices.forEach((device: Device) => {
                if (this.data.deviceFilter && this.data.deviceFilter.indexOf(device.type) !== -1) {
                    // filtered device
                } else if (device.tags) {
                    Object.values(device.tags).forEach((t: Tag) => {
                        this.tags.push(<TagElement>{
                            id: t.id, name: t.name, address: t.address,
                            device: device.name, checked: (t.id === this.data.variableId), error: null
                        });
                    }
                    );
                }
            }
            );
        }
        this.dataSource = new MatTableDataSource(this.tags);
    }
}

export interface TagElement {
    id: string;
    name: string;
    address: string;
    device: string;
    checked: boolean;
    error: string;
}

export interface DeviceTagSelectionData {
    variableId?: string;
    multiSelection?: boolean;
    deviceFilter?: DeviceType[];
    variablesId?: string[];
}
