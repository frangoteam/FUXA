import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { Role } from '../../_models/user';
import { MatLegacyDialog as MatDialog} from '@angular/material/legacy-dialog';
import { UsersRoleEditComponent } from '../users-role-edit/users-role-edit.component';
import { MatSort } from '@angular/material/sort';
import { UserService } from '../../_services/user.service';
import { TranslateService } from '@ngx-translate/core';
import { ConfirmDialogComponent } from '../../gui-helpers/confirm-dialog/confirm-dialog.component';

@Component({
    selector: 'app-user-roles',
    templateUrl: './users-roles.component.html',
    styleUrls: ['./users-roles.component.scss']
})
export class UsersRolesComponent implements OnInit, AfterViewInit {

    displayedColumns = ['select', 'index', 'name', 'description', 'remove'];
    dataSource = new MatTableDataSource([]);

	roles: Role[];

    @ViewChild(MatTable, {static: false}) table: MatTable<any>;
	@ViewChild(MatSort, {static: false}) sort: MatSort;

    constructor(private dialog: MatDialog,
                private translateService: TranslateService,
                private userService: UserService) { }

    ngOnInit() {
		this.loadRoles();
    }

    ngAfterViewInit() {
		this.dataSource.sort = this.sort;
	}

    onAddRole() {
		let role = new Role();
		this.editRole(role);
	}

    onEditRole(role: Role) {
		this.editRole(role);
	}

    onRemoveRole(role: Role) {
        let msg = this.translateService.instant('msg.role-remove', { value: role.name });
        let dialogRef = this.dialog.open(ConfirmDialogComponent, {
            data: { msg: msg },
            position: { top: '60px' }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result && role) {
                this.userService.removeRole(role).subscribe(result => {
                    this.loadRoles();
                }, err => {
			        console.error('remove Roles err: ' + err);
                });
            }
        });
	}

    private loadRoles() {
		this.roles = [];
		this.userService.getRoles().subscribe(result => {
			Object.values<Role>(result).forEach(role => {
				this.roles.push(role);
			});
			this.bindToTable(this.roles);
		}, err => {
			console.error('get Roles err: ' + err);
		});
	}

    private editRole(role: Role) {
		let mrole: Role = JSON.parse(JSON.stringify(role));
		let dialogRef = this.dialog.open(UsersRoleEditComponent, {
			position: { top: '60px' },
			data: mrole
		});
		dialogRef.afterClosed().subscribe(result => {
			if (result) {
                this.userService.setRole(result).subscribe(result => {
                    this.loadRoles();
                }, err => {
			        console.error('set Roles err: ' + err);
                });
			}
		}, err => {
		});
	}

    private bindToTable(roles: Role[]) {
		this.dataSource.data = roles;
	}
}
