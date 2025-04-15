/* eslint-disable @angular-eslint/component-class-suffix */
import { Component, OnInit, AfterViewInit, ViewChild, OnDestroy } from '@angular/core';
import { MatLegacyTable as MatTable, MatLegacyTableDataSource as MatTableDataSource } from '@angular/material/legacy-table';
import { MatSort } from '@angular/material/sort';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';

import { UserService } from '../_services/user.service';
import { Role, User, UserGroups } from '../_models/user';
import { UserEditComponent, UserInfo } from './user-edit/user-edit.component';
import { ProjectService } from '../_services/project.service';
import { ConfirmDialogComponent } from '../gui-helpers/confirm-dialog/confirm-dialog.component';
import { TranslateService } from '@ngx-translate/core';
import { SettingsService } from '../_services/settings.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
	selector: 'app-users',
	templateUrl: './users.component.html',
	styleUrls: ['./users.component.css']
})
export class UsersComponent implements OnInit, AfterViewInit, OnDestroy {

	displayedColumns = ['select', 'username', 'fullname', 'groups', 'start', 'remove'];
	dataSource = new MatTableDataSource([]);

	users: User[];
	usersInfo = {};
	roles: Role[];

	@ViewChild(MatTable, {static: false}) table: MatTable<any>;
	@ViewChild(MatSort, {static: false}) sort: MatSort;

    private destroy$ = new Subject<void>();

	constructor(private dialog: MatDialog,
				private projectService: ProjectService,
                private translateService: TranslateService,
				private settingsService: SettingsService,
				private userService: UserService) { }

	ngOnInit() {
		this.loadUsers();
		this.userService.getRoles().pipe(
            takeUntil(this.destroy$)
		).subscribe((roles: Role[]) => {
			this.roles = roles;
		}, err => {
			console.error('get Roles err: ' + err);
		});
	}

	ngAfterViewInit() {
		this.dataSource.sort = this.sort;
	}

	ngOnDestroy() {
		this.destroy$.next(null);
        this.destroy$.complete();
	}

	onAddUser() {
		let user = new User();
		this.editUser(user, user);
	}

	onEditUser(user: User) {
		this.editUser(user, user);
	}

	onRemoveUser(user: User) {
        let msg = this.translateService.instant('msg.user-remove', { value: user.username });
        let dialogRef = this.dialog.open(ConfirmDialogComponent, {
            data: { msg: msg },
            position: { top: '60px' }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result && user) {
				this.userService.removeUser(user).subscribe(result => {
					this.users = this.users.filter(function(el) { return el.username !== user.username; });
					this.bindToTable(this.users);
				}, err => {
				});
            }
        });
	}

	isAdmin(user: User): boolean {
		if (user && user.username === 'admin') {
			return true;
		} else {
			return false;
		}
	}

	isRolePermission() {
        return this.settingsService.getSettings()?.userRole;
    }

	permissionValueToLabel(user: User): string {
		if (this.isRolePermission()) {
			const userInfo = new UserInfo(user?.info);
			return this.roles?.filter(role => userInfo.roleIds?.includes(role.id)).map(role => role.name).join(', ');
		} else {
			return UserGroups.GroupToLabel(user.groups);
		}
	}

	getViewStartName(username: string) {
		return this.usersInfo[username];
	}

	private loadUsers() {
		this.users = [];
		this.usersInfo = {};
		this.userService.getUsers(null).pipe(
            takeUntil(this.destroy$)
		).subscribe(result => {
			Object.values<User>(result).forEach(user => {
				if (user.info) {
					const start = JSON.parse(user.info)?.start;
					const view = this.projectService.getViewFromId(start);
					this.usersInfo[user.username] = view?.name;
				}
				this.users.push(user);
			});
			this.bindToTable(this.users);
		}, err => {
			console.error('get Users err: ' + err);
		});
	}

	private editUser(user: User, current: User) {
		let muser: User = JSON.parse(JSON.stringify(user));
		muser.password = '';
		let dialogRef = this.dialog.open(UserEditComponent, {
			position: { top: '60px' },
			data: { user: muser, current: current, users: this.users.map((u: User) => u.username) }
		});
		dialogRef.afterClosed().subscribe(result => {
			if (result) {
				this.userService.setUser(result).subscribe(result => {
					this.loadUsers();
				}, err => {
				});
			}
		}, err => {
		});
	}

	private bindToTable(users) {
		this.dataSource.data = users;
	}
}

