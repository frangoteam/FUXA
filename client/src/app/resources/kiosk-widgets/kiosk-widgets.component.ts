import { Component, OnInit } from '@angular/core';
import { MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { KioskWidgetsService } from './kiosk-widgets.service';
import { Observable } from 'rxjs';
import { ResourceGroup } from '../../_models/resources';

@Component({
    selector: 'app-kiosk-widgets',
    templateUrl: './kiosk-widgets.component.html',
    styleUrls: ['./kiosk-widgets.component.scss']
})
export class KioskWidgetsComponent implements OnInit {

    resourceWidgets$: Observable<ResourceGroup[]>;

    constructor(
        public dialogRef: MatDialogRef<KioskWidgetsComponent>,
        private kioskWidgetService: KioskWidgetsService,
    ) { }

    ngOnInit() {
        this.resourceWidgets$ = this.kioskWidgetService.resourceWidgets$;
    }

    onOkClick(): void {
        this.dialogRef.close();
    }
}
