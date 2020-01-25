import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { Injectable, Injector } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs/Observable';

import { AuthService } from '../_services/auth.service';
import { ProjectService } from '../_services/project.service';

const TOKEN_HEADER_KEY = 'x-access-token';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

    constructor(private injector: Injector) {
    }

    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        const authService = this.injector.get(AuthService)
        if (authService.getUserToken) {
            const token = authService.getUserToken();
            if (token != null) {
                req = req.clone({ headers: req.headers.set(TOKEN_HEADER_KEY, token) });
            }
        }
        // if (!req.headers.has('Content-Type')) {
        //     req = req.clone({ headers: req.headers.set('Content-Type', 'application/json') });
        // }
        // req = req.clone({ headers: req.headers.set('Accept', 'application/json') });
        return next.handle(req).do((event: HttpEvent<any>) => {
            // if (event instanceof HttpResponse) {
                // do stuff with response if you want
            // }
        }, (err: any) => {
            if (err instanceof HttpErrorResponse) {
                if (err.status === 403) {
                    // redirect to the login route or show a modal
                    authService.signOut();
                    const projectService = this.injector.get(ProjectService)
                    projectService.reload();
                }
            }
        });
    }
}

export const httpInterceptorProviders = [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
];