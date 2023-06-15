import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { Injectable, Injector } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { AuthService } from '../_services/auth.service';
import { ProjectService } from '../_services/project.service';

const TOKEN_HEADER_KEY = 'x-access-token';
const USER_HEADER_KEY = 'x-auth-user';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

    constructor(private injector: Injector) {
    }

    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        const authService = this.injector.get(AuthService);
        if (authService.getUserToken) {
            const token = authService.getUserToken();
            if (token != null) {
                const user = authService.getUser();

                if (user) {
                    let locuser = {user: user.username, groups: user.groups};
                    req = req.clone({ headers: req.headers.set(USER_HEADER_KEY, JSON.stringify(locuser)) });
                }
                req = req.clone({ headers: req.headers.set(TOKEN_HEADER_KEY, token) });
            }
        }
        return next.handle(req).pipe(
            tap((event: HttpEvent<any>) => {
            }, (err: any) => {
                if (err instanceof HttpErrorResponse) {
                    if (err.status === 403) {
                        authService.signOut();
                        const projectService = this.injector.get(ProjectService);
                        projectService.reload();
                    }
                }
            }
        ));
    }
}

export const httpInterceptorProviders = [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
];
