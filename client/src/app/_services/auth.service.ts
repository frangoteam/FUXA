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
	private useRefreshCookieAuth = false;

	constructor(
		private http: HttpClient,
		private settings: SettingsService
	) {
		this.useRefreshCookieAuth = !!this.settings.getSettings()?.enableRefreshCookieAuth;
		let user = JSON.parse(sessionStorage.getItem('currentUser'));
		if (user) {
			this.currentUser = user;
			if (!this.useRefreshCookieAuth && this.isTokenExpired(this.currentUser?.token)) {
				// Token expired: drop stale token to avoid socket auth failures on refresh.
				if (this.isGuestUser(this.currentUser)) {
					this.currentUser.token = null;
					this.saveUserToken(this.currentUser);
				} else {
					this.currentUser = null;
					sessionStorage.removeItem('currentUser');
				}
			}
		}
		this.currentUser$.next(this.currentUser);

		if (this.useRefreshCookieAuth) {
			this.refreshAccessToken();
		}

		this.settings.settings$.subscribe((appSettings) => {
			const enabled = !!appSettings?.enableRefreshCookieAuth;
			const wasEnabled = this.useRefreshCookieAuth;
			this.useRefreshCookieAuth = enabled;
			if (enabled && !wasEnabled) {
				// Move to refresh-cookie flow: drop stored token and refresh.
				if (this.currentUser) {
					this.currentUser.token = null;
					this.saveUserToken(this.currentUser);
					this.currentUser$.next(this.currentUser);
				}
				this.refreshAccessToken();
			}
		});
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
		if (this.useRefreshCookieAuth && environment.serverEnabled) {
			let header = new HttpHeaders({ 'Skip-Auth': 'true', 'Skip-Error': 'true' });
			this.http.post(this.endPointConfig + '/api/signout', {}, { headers: header, withCredentials: true }).subscribe({
				next: () => this.finalizeSignOut(),
				error: () => this.finalizeSignOut()
			});
			return;
		}
		this.finalizeSignOut();
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
		if (!this.currentUser) {
			return;
		}
		this.currentUser.token = token;
		this.saveUserToken(this.currentUser);
	}

	// to check by page refresh
	private saveUserToken(user: UserProfile) {
		if (this.useRefreshCookieAuth) {
			const toStore = user ? {
				username: user.username,
				fullname: user.fullname,
				groups: user.groups,
				info: user.info,
				infoRoles: user.infoRoles
			} : null;
			if (toStore) {
				sessionStorage.setItem('currentUser', JSON.stringify(toStore));
			} else {
				sessionStorage.removeItem('currentUser');
			}
		} else {
			sessionStorage.setItem('currentUser', JSON.stringify(user));
		}
	}

	private removeUser(): boolean {
		const result = !!this.currentUser;
		this.currentUser = null;
		sessionStorage.removeItem('currentUser');
		this.currentUser$.next(this.currentUser);
		return result;
	}

	private isGuestUser(user: UserProfile): boolean {
		if (!user) {
			return false;
		}
		if (user.username === 'guest') {
			return true;
		}
		if (Array.isArray(user.groups) && user.groups.includes('guest')) {
			return true;
		}
		return false;
	}

	private finalizeSignOut() {
		if (this.removeUser()) {
			window.location.reload();
		}
	}

	private refreshAccessToken() {
		if (!environment.serverEnabled || !this.useRefreshCookieAuth) {
			return;
		}
		let header = new HttpHeaders({ 'Skip-Auth': 'true', 'Skip-Error': 'true' });
		this.http.post(this.endPointConfig + '/api/refresh', {}, { headers: header, withCredentials: true }).subscribe({
			next: (result: any) => {
				if (result?.data?.token) {
					const refreshed: UserProfile = {
						...(this.currentUser || {}),
						username: result.data.username || this.currentUser?.username,
						fullname: result.data.fullname || this.currentUser?.fullname,
						groups: result.data.groups || this.currentUser?.groups,
						info: result.data.info || this.currentUser?.info,
						token: result.data.token
					};
					if (refreshed.info) {
						refreshed.infoRoles = JSON.parse(refreshed.info)?.roles;
					}
					this.currentUser = refreshed;
					this.saveUserToken(this.currentUser);
					this.currentUser$.next(this.currentUser);
				}
			},
			error: () => {
				if (!this.isGuestUser(this.currentUser)) {
					this.removeUser();
				}
			}
		});
	}

	private isTokenExpired(token: string): boolean {
		if (!token) {
			return true;
		}
		try {
			const payload = this.decodeJwtPayload(token);
			const exp = payload?.exp;
			if (!exp) {
				return false;
			}
			const nowSeconds = Math.floor(Date.now() / 1000);
			return nowSeconds >= exp;
		} catch (err) {
			return true;
		}
	}

	private decodeJwtPayload(token: string): any {
		const parts = token.split('.');
		if (parts.length < 2) {
			throw new Error('Invalid token');
		}
		const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
		const json = decodeURIComponent(atob(base64).split('').map((c) =>
			'%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
		).join(''));
		return JSON.parse(json);
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
