import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { Subscription } from 'rxjs';

import { ResourceGroup, Resources, ResourceType } from '../../_models/resources';
import { ResourcesService } from '../../_services/resources.service';
import { EndPointApi } from '../../_helpers/endpointapi';

@Component({
    selector: 'app-lib-images',
    templateUrl: './lib-images.component.html',
    styleUrls: ['./lib-images.component.css']
})
export class LibImagesComponent implements AfterViewInit, OnDestroy {
    private endPointConfig: string = EndPointApi.getURL();
    resImages?: ResourceGroup[];
    subscription: Subscription;

    constructor(
        private dialogRef: MatDialogRef<LibImagesComponent>,
        private resourcesService: ResourcesService) { }

    ngAfterViewInit() {
        this.loadResources();
    }

    ngOnDestroy() {
        try {
            this.subscription.unsubscribe();
        } catch (err) {
            console.error(err);
        }
    }

    loadResources() {
        this.subscription = this.resourcesService.getResources(ResourceType.images).subscribe((result: Resources) => {
            const groups = result?.groups || [];
            groups.forEach(group => {
                group.items.forEach(item => {
                    item.path = `${this.endPointConfig}/${item.path}`;
                });
            });
            this.resImages = groups;
        }, err => {
            console.error('get Resources images error: ' + err);
        });
    }

    onSelect(imgPath: string) {
        this.dialogRef.close(imgPath);
    }

    onNoClick(): void {
        this.dialogRef.close();
    }
}
