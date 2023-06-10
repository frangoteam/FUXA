import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';

import { User, UserGroups } from '../_models/user';
import { environment } from '../../environments/environment';
import { EndPointApi } from '../_helpers/endpointapi';

@Injectable()
export class AuthService {

	private currentUser: UserProfile;
	private endPointConfig: string = EndPointApi.getURL();
	currentUser$ = new BehaviorSubject<UserProfile>(null);

	constructor(private http: HttpClient) {
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
						this.saveUserToken(this.currentUser);
						this.currentUser$.next(this.currentUser);
					}
					observer.next();
				}, err => {
					console.error(err);
					observer.error(err);
				});
			} else {
				observer.next();
			}
		});

	}

	signOut() {
		this.removeUser();
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

	private removeUser() {
		this.currentUser = null;
		localStorage.removeItem('currentUser');
		this.currentUser$.next(this.currentUser);
	}
}

export class UserProfile extends User {
	token: string;
}
