import { Component, Inject } from '@angular/core';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';
import { HeaderItem, HeaderItemType } from '../../../_models/hmi';
import { BehaviorSubject, Observable, combineLatest, map, of } from 'rxjs';
import { ProjectService } from '../../../_services/project.service';
import { Define } from '../../../_helpers/define';
import { Utils } from '../../../_helpers/utils';

@Component({
    selector: 'app-layout-header-item-property',
    templateUrl: './layout-header-item-property.component.html',
    styleUrls: ['./layout-header-item-property.component.scss']
})
export class LayoutHeaderItemPropertyComponent {
    item: HeaderItem;
    icons$: Observable<string[]>;
    filteredIcons$: Observable<string[]>;
    filterText = '';
    private filterTextSubject = new BehaviorSubject<string>('');
    headerType = <HeaderItemType[]>['button', 'label', 'image'];
    defaultColor = Utils.defaultColor;

    constructor(
        public projectService: ProjectService,
        public dialogRef: MatDialogRef<LayoutHeaderItemPropertyComponent>,
        @Inject(MAT_DIALOG_DATA) public data: HeaderItem) {

        this.item = data;
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

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.dialogRef.close(this.item);
    }

    onFilterChange() {
        this.filterTextSubject.next(this.filterText);
    }
}
