/* eslint-disable @angular-eslint/component-class-suffix */
import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';

import { UserService } from '../_services/user.service';
import { User, UserGroups } from '../_models/user';
import { UserEditComponent } from './user-edit/user-edit.component';
import { ProjectService } from '../_services/project.service';

@Component({
	selector: 'app-users',
	templateUrl: './users.component.html',
	styleUrls: ['./users.component.css']
})
export class UsersComponent implements OnInit, AfterViewInit {

	displayedColumns = ['select', 'username', 'fullname', 'groups', 'start', 'remove'];
	dataSource = new MatTableDataSource([]);

	users: User[];
	usersInfo = {};

	@ViewChild(MatTable, {static: false}) table: MatTable<any>;
	@ViewChild(MatSort, {static: false}) sort: MatSort;

	constructor(private dialog: MatDialog,
		private projectService: ProjectService,
		private userService: UserService) { }

	ngOnInit() {
		this.loadUsers();
	}

	ngAfterViewInit() {
		this.dataSource.sort = this.sort;
	}

	onAddUser() {
		let user = new User();
		this.editUser(user, user);
	}

	onEditUser(user: User) {
		this.editUser(user, user);
	}

	onRemoveUser(user: User) {
		this.editUser(user, null);
	}

	isAdmin(user: User): boolean {
		if (user && user.username === 'admin') {
			return true;
		} else {
			return false;
		}
	}

	groupValueToLabel(grp: number): string {
		return UserGroups.GroupToLabel(grp);
	}

	getViewStartName(username: string) {
		return this.usersInfo[username];
	}

	private loadUsers() {
		this.users = [];
		this.usersInfo = {};
		this.userService.getUsers(null).subscribe(result => {
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
				if (!current) {
					this.userService.removeUser(result).subscribe(result => {
						this.users = this.users.filter(function(el) { return el.username !== muser.username; });
						this.bindToTable(this.users);
					}, err => {
					});
				} else {
					this.userService.setUser(result).subscribe(result => {
						this.loadUsers();
					}, err => {
					});
				}
			}
		}, err => {
		});
	}

	private bindToTable(users) {
		this.dataSource.data = users;
	}
}

