/* eslint-disable @angular-eslint/component-class-suffix */
import { Component, Inject, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { SelOptionsComponent } from '../gui-helpers/sel-options/sel-options.component';

import { UserService } from '../_services/user.service';
import { User, UserGroups } from '../_models/user';

@Component({
	selector: 'app-users',
	templateUrl: './users.component.html',
	styleUrls: ['./users.component.css']
})
export class UsersComponent implements OnInit, AfterViewInit {

	displayedColumns = ['select', 'username', 'fullname', 'groups', 'remove'];
	dataSource = new MatTableDataSource([]);

	users: User[];

	@ViewChild(MatTable, {static: false}) table: MatTable<any>;
	@ViewChild(MatSort, {static: false}) sort: MatSort;

	constructor(private dialog: MatDialog,
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

	private loadUsers() {
		this.users = [];
		this.userService.getUsers(null).subscribe(result => {
			Object.values<User>(result).forEach(u => {
				this.users.push(u);
			});
			this.bindToTable(this.users);
		}, err => {
			console.error('get Users err: ' + err);
		});
	}

	private editUser(user: User, current: User) {
		let muser: User = JSON.parse(JSON.stringify(user));
		muser.password = '';
		let dialogRef = this.dialog.open(DialogUser, {
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

@Component({
	selector: 'app-dialog-user',
	templateUrl: './user.dialog.html',
})
export class DialogUser {
	selectedGroups = [];
	groups = UserGroups.Groups;
	showPassword: boolean;

	@ViewChild(SelOptionsComponent, {static: false}) seloptions: SelOptionsComponent;

	constructor(public dialogRef: MatDialogRef<DialogUser>,
		@Inject(MAT_DIALOG_DATA) public data: any) {
		this.selectedGroups = UserGroups.ValueToGroups(this.data.user.groups);
	}

	onNoClick(): void {
		this.dialogRef.close();
	}

	onOkClick(): void {
		if (this.seloptions) {
			this.data.user.groups = UserGroups.GroupsToValue(this.seloptions.selected);
		}
		this.dialogRef.close(this.data.user);
	}

	isValid(name): boolean {
		if (!this.data.current) {	// to remove
			return true;
		} else if (name) {
			let editname = (this.data.user) ? this.data.user.username : null;
			return (this.data.users.find((n) => n === name && n !== editname)) ? false : true;
		}
		return false;
	}

	isNewUser() {
		return (this.data.current && this.data.current.username) ? true : false;
	}

	isAdmin(): boolean {
		if (this.data.user && this.data.user.username === 'admin') {
			return true;
		} else {
			return false;
		}
	}

    keyDownStopPropagation(event) {
        event.stopPropagation();
    }
}
