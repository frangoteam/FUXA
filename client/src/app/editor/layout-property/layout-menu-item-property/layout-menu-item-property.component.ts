import { AfterViewInit, ChangeDetectorRef, Component, Inject, OnDestroy, ViewChild } from '@angular/core';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';
import { SelOptionType, SelOptionsComponent } from '../../../gui-helpers/sel-options/sel-options.component';
import { BehaviorSubject, Observable, Subject, combineLatest, map, of, takeUntil } from 'rxjs';
import { Define } from '../../../_helpers/define';
import { Role, UserGroups } from '../../../_models/user';
import { LinkType, NaviItem } from '../../../_models/hmi';
import { ProjectService } from '../../../_services/project.service';
import { UploadFile } from '../../../_models/project';
import { UserService } from '../../../_services/user.service';
import { SettingsService } from '../../../_services/settings.service';
import { Utils } from '../../../_helpers/utils';

@Component({
    selector: 'app-layout-menu-item-property',
    templateUrl: './layout-menu-item-property.component.html',
    styleUrls: ['./layout-menu-item-property.component.scss']
})
export class LayoutMenuItemPropertyComponent implements AfterViewInit, OnDestroy {
    selected = [];
    options = [];
    icons$: Observable<string[]>;
    filteredIcons$: Observable<string[]>;
    filterText = '';
    private filterTextSubject = new BehaviorSubject<string>('');
    linkAddress = LinkType.address;
    linkAlarms = LinkType.alarms;
    private destroy$ = new Subject<void>();

    @ViewChild(SelOptionsComponent, { static: false }) seloptions: SelOptionsComponent;

    constructor(public projectService: ProjectService,
                private userService: UserService,
                private cdr: ChangeDetectorRef,
                private settingsService: SettingsService,
                public dialogRef: MatDialogRef<LayoutMenuItemPropertyComponent>,
                @Inject(MAT_DIALOG_DATA) public data: any) {
                this.data.item.children = this.data.item.children || [];

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

    ngAfterViewInit() {
        if (this.isRolePermission()) {
            this.userService.getRoles().pipe(
                map(roles => roles.sort((a, b) => a.index - b.index)),
                takeUntil(this.destroy$)
            ).subscribe((roles: Role[]) => {
                this.options = roles?.map(role => <SelOptionType>{ id: role.id, label: role.name });
                this.selected = this.options.filter(role => this.data.permissionRoles?.enabled?.includes(role.id));
            }, err => {
                console.error('get Roles err: ' + err);
            });
        } else {
            this.selected = UserGroups.ValueToGroups(this.data.permission);
            this.options = UserGroups.Groups;
        }
        this.cdr.detectChanges();
    }

    ngOnDestroy() {
        this.destroy$.next(null);
        this.destroy$.complete();
    }

    isRolePermission() {
        return this.settingsService.getSettings()?.userRole;
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        if (this.isRolePermission()) {
            if (!this.data.permissionRoles) {
                this.data.permissionRoles = { enabled: null };
            }
            this.data.permissionRoles.enabled = this.seloptions.selected?.map(role => role.id);

        } else {
            this.data.permission = UserGroups.GroupsToValue(this.seloptions.selected);
        }
        this.dialogRef.close(this.data);
        //Need to check this!
        this.data.item.children = this.data.item.children || [];
    }

    /**
     * add image to view
     * @param event selected file
     */
    onSetImage(event) {
        if (event.target.files) {
            let filename = event.target.files[0].name;
            let fileToUpload = { type: filename.split('.').pop().toLowerCase(), name: filename.split('/').pop(), data: null };
            let reader = new FileReader();
            reader.onload = () => {
                try {
                    fileToUpload.data = reader.result;
                    this.projectService.uploadFile(fileToUpload).subscribe((result: UploadFile) => {
                        this.data.item.image = result.location;
                        this.data.item.icon = null;
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

    onFilterChange() {
        this.filterTextSubject.next(this.filterText);
    }


    onAddChild() {
        const child = new NaviItem();
        child.id = Utils.getShortGUID();
        child.text = 'New Submenu Item';
        this.data.item.children = this.data.item.children || [];
        this.data.item.children.push(child);
        console.log('Added child:', child, 'Total children:', this.data.item.children);
        this.cdr.detectChanges();
   }

    onDeleteChild(index: number) {
        this.data.item.children.splice(index, 1);
        this.cdr.detectChanges();
    }
}
