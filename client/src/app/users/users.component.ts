import { Component, Inject, OnInit, AfterViewInit, ViewChild, Input, Output, EventEmitter } from '@angular/core';
import { MatTable, MatTableDataSource, MatSort, MatMenuTrigger } from '@angular/material';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

import { SelOptionsComponent } from '../gui-helpers/sel-options/sel-options.component';

import { UserService } from '../_services/user.service';
import { User, UserGroups } from '../_models/user';

@Component({
	selector: 'app-users',
	templateUrl: './users.component.html',
	styleUrls: ['./users.component.css']
})
export class UsersComponent implements OnInit, AfterViewInit {

	displayedColumns = ['select', 'username', 'groups', 'remove'];
	dataSource = new MatTableDataSource([]);

	users: User[];

	@ViewChild(MatTable) table: MatTable<any>;
	@ViewChild(MatSort) sort: MatSort;

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
		this.editUser(user, 1);
	}

	onEditUser(user: User) {
		this.editUser(user, 0);
	}

	onRemoveUser(user: User) {
		this.editUser(user, -1);
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
			console.log('get Users err: ' + err);
		});
	}

	private editUser(user: User, toAdd: number) {
		let muser: User = JSON.parse(JSON.stringify(user));
		muser.password = '';
		let dialogRef = this.dialog.open(DialogUser, {
			position: { top: '60px' },
			data: { user: muser, editmode: toAdd, users: this.users.map((u: User) => { return u.username }) }
		});
		dialogRef.afterClosed().subscribe(result => {
			if (result) {
				if (toAdd < 0) {
					this.userService.removeUser(result).subscribe(result => {
						this.users = this.users.filter(function (el) { return el.username !== muser.username; });
						this.bindToTable(this.users);
					}, err => {
					});
				} else {
					this.userService.setUser(result).subscribe(result => {
						if (toAdd < 0) {
							this.users.push(muser);
						} else if (toAdd > 0) {
							this.users.push(muser);
						} else {
							user.groups = muser.groups;
							if (muser.password) {
								user.password = muser.password;
							}
						}
						this.bindToTable(this.users);
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
	selector: 'dialog-user',
	templateUrl: './user.dialog.html',
})
export class DialogUser {
	selectedGroups = [];
	groups = UserGroups.Groups;

	@ViewChild(SelOptionsComponent) seloptions: SelOptionsComponent;

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
		if (this.data.editmode <= 0) {
			return true;
		} else {
			return (this.data.users.find((n) => n === name)) ? false : true;
		}
	}

	isAdmin(): boolean {
		if (this.data.user && this.data.user.username === 'admin') {
			return true;
		} else {
			return false;
		}
	}
}