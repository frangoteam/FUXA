import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';

import { User, UserGroups } from '../_models/user';
import { environment } from '../../environments/environment';
import { EndPointApi } from '../_helpers/endpointapi';
import { SettingsService } from './settings.service';
import { Utils } from '../_helpers/utils';

@Injectable()
export class AuthService {

	private currentUser: UserProfile;
	private endPointConfig: string = EndPointApi.getURL();
	currentUser$ = new BehaviorSubject<UserProfile>(null);

	constructor(
		private http: HttpClient,
		private settings: SettingsService
	) {
		let user = JSON.parse(localStorage.getItem('currentUser'));
		if (user) {
		  this.currentUser = user;
		}
		this.currentUser$.next(this.currentUser);
	}

	signIn(username: string, password: string) {
		return new Observable((observer) => {
			if (environment.serverEnabled) {
				let header = new HttpHeaders({ 'Content-Type': 'application/json' });
				return this.http.post(this.endPointConfig + '/api/signin', { username: username, password: password }).subscribe((result: any) => {
					if (result) {
						this.currentUser = <UserProfile>result.data;
						if (this.currentUser.info) {
							this.currentUser.infoRoles = JSON.parse(this.currentUser.info)?.roles;
						}
						this.saveUserToken(this.currentUser);
						this.currentUser$.next(this.currentUser);
					}
					observer.next(null);
				}, err => {
					console.error(err);
					observer.error(err);
				});
			} else {
				observer.next(null);
			}
		});

	}

	signOut() {
		if (this.removeUser()) {
			window.location.reload();
		}
	}

	getUser(): User {
		return this.currentUser;
	}

	getUserProfile(): UserProfile {
		return this.currentUser;
	}

	getUserToken(): string {
		return this.currentUser?.token;
	}

    isAdmin(): boolean {
        if (this.currentUser && UserGroups.ADMINMASK.indexOf(this.currentUser.groups) !== -1) {
            return true;
        }
        return false;
    }

	setNewToken(token: string) {
		this.currentUser.token = token;
		this.saveUserToken(this.currentUser);
	}

	// to check by page refresh
	private saveUserToken(user: UserProfile) {
		localStorage.setItem('currentUser', JSON.stringify(user));
	}

	private removeUser(): boolean {
		const result = !!this.currentUser;
		this.currentUser = null;
		localStorage.removeItem('currentUser');
		this.currentUser$.next(this.currentUser);
		return result;
	}

	/**
	 * for Role show/enabled or 16 bitmask (0-7 enabled / 8-15 show)
	 * @param {*} contextPermission permission could be permission or permissionRoles
	 * @param {*} forceUndefined return true if params are undefined/null/0
	 * @returns { show: true/false, enabled: true/false }
	 */
	checkPermission(context, forceUndefined = false): { show: boolean, enabled: boolean } {
		var userPermission: any = this.currentUser?.groups;
		const settings = this.settings.getSettings();
		if (!userPermission && !context) {
			// No user and No context
			return { show: forceUndefined || !settings.secureEnabled, enabled: forceUndefined || !settings.secureEnabled };
		}
		if (userPermission === -1 || userPermission === 255 || Utils.isNullOrUndefined(context)) {
			// admin
			return { show: true, enabled: true };
		}
		const contextPermission = settings.userRole ? context.permissionRoles : context.permission;
		if (settings.userRole) {
			if (userPermission && !contextPermission) {
				return { show: forceUndefined, enabled: forceUndefined };
			}
		} else {
			if (userPermission && !context && !contextPermission) {
				return { show: true, enabled: false };
			}
		}
		var result = { show: false, enabled : false };
		if (settings.userRole) {
			var userPermissionInfoRoles = this.currentUser?.infoRoles;
			if (userPermissionInfoRoles) {
				let voidRole = { show: true, enabled: true };
				if (contextPermission.show && contextPermission.show.length) {
					result.show = userPermissionInfoRoles.some(role => contextPermission.show.includes(role));
					voidRole.show = false;
				}
				if (contextPermission.enabled && contextPermission.enabled.length) {
					result.enabled = userPermissionInfoRoles.some(role => contextPermission.enabled.includes(role));
					voidRole.enabled = false;
				}
				if (voidRole.show && voidRole.enabled) {
					return voidRole;
				}
			} else {
				result.show = contextPermission && contextPermission.show && contextPermission.show.length ? false : true;
				result.enabled = contextPermission && contextPermission.enabled && contextPermission.enabled.length ? false : true;
			}
		} else {
			if (userPermission) {
				var mask = (contextPermission >> 8);
				result.show = mask ? (mask & userPermission) !== 0 : true;
				mask = (contextPermission & 255);
				result.enabled = mask ? (mask & userPermission) !== 0 : true;
			} else {
				result.show = contextPermission ? false : true;
				result.enabled = contextPermission ? false : true;
			}
		}
		return result;
	}
}

export class UserProfile extends User {
	token: string;
	infoRoles?: string[];
}

export type CheckPermissionFunction = (context, forceUndefined?) => { show: boolean, enabled: boolean };
