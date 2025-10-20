import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { EndPointApi } from '../_helpers/endpointapi';
import { Role, User } from '../_models/user';
import { environment } from '../../environments/environment';
import { ToastrService } from 'ngx-toastr';
import { TranslateService } from '@ngx-translate/core';
import { ResWebApiService } from './rcgi/reswebapi.service';
import { ResDemoService } from './rcgi/resdemo.service';
import { ResClientService } from './rcgi/resclient.service';
import { ResourceStorageService } from './rcgi/resource-storage.service';
import { AppService } from './app.service';

@Injectable()
export class UserService {

    private endPointConfig: string = EndPointApi.getURL();

    private storage: ResourceStorageService;

    constructor(private http: HttpClient,
                private translateService: TranslateService,
                private toastr: ToastrService,
                private appService: AppService,
                private resewbApiService: ResWebApiService,
                private resDemoService: ResDemoService,
                private resClientService: ResClientService) {
        this.storage = resewbApiService;
        if (!environment.serverEnabled || appService.isDemoApp) {
            this.storage = resDemoService;
        } else if (appService.isClientApp) {
            this.storage = resClientService;
        }
    }

    getUsers(user: any): Observable<any> {
        let header = new HttpHeaders({ 'Content-Type': 'application/json' });
        let params = user;
        return this.http.get<any>(this.endPointConfig + '/api/users', { headers: header, params: params });
    }

    setUser(user: User) {
        return new Observable((observer) => {
            if (environment.serverEnabled) {
                let header = new HttpHeaders({ 'Content-Type': 'application/json' });
                this.http.post<any>(this.endPointConfig + '/api/users', { headers: header, params: user }).subscribe(result => {
                    observer.next(null);
                }, err => {
                    console.error(err);
                    this.notifySaveError();
                    observer.error(err);
                });
            } else {
                observer.next(null);
            }
        });
    }

    removeUser(user: User) {
        return new Observable((observer) => {
            if (environment.serverEnabled) {
                let header = new HttpHeaders({ 'Content-Type': 'application/json' });
                this.http.delete<any>(this.endPointConfig + '/api/users', { headers: header, params: {param: user.username} }).subscribe(result => {
                    observer.next(null);
                }, err => {
                    console.error(err);
                    this.notifySaveError();
                    observer.error(err);
                });
            } else {
                observer.next(null);
            }
        });
    }

    getRoles(): Observable<Role[]> {
        return new Observable((observer) => {
            this.storage.getRoles().subscribe(result => {
                observer.next(result);
            }, err => {
                console.error(err);
                observer.error(err);
            });
        });
    }

    setRole(role: Role) {
        return new Observable((observer) => {
            this.storage.setRoles([role]).subscribe(result => {
                observer.next(result);
            }, err => {
                console.error(err);
                observer.error(err);
            });
        });
    }

    removeRole(role: Role) {
        return new Observable((observer) => {
            this.storage.removeRoles([role]).subscribe(result => {
                observer.next(result);
            }, err => {
                console.error(err);
                observer.error(err);
            });
        });
    }

    //#region Notify
    private notifySaveError() {
        let msg = '';
        this.translateService.get('msg.users-save-error').subscribe((txt: string) => { msg = txt; });
        this.toastr.error(msg, '', {
            timeOut: 3000,
            closeButton: true,
            disableTimeOut: true
        });
    }
    //#endregion
}
