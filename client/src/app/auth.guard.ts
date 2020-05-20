import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Injectable } from '@angular/core';
import { AuthService } from './_services/auth.service';
import { ProjectService } from './_services/project.service';
import { ToastrService } from 'ngx-toastr';
import { TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { of } from 'rxjs/observable/of';
import { map } from 'rxjs/operators';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(private authService: AuthService,
        private translateService: TranslateService,
        private toastr: ToastrService,
        private projectService: ProjectService, 
        private router: Router) { 
        }

    canActivate(next: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
        if (!this.projectService.isSecurityEnabled()) {
            return of(true);
        }
        if (this.authService.isAdmin()) {
            return of(true);
        }
        return this.projectService.checkServer().pipe(map((response: any) => {
            if (response && !response.secureEnabled) {
                return true;
            }
            return false;
        }));
    }

    private notifySaveError() {
        let msg = '';
        this.translateService.get('msg.signin-failed').subscribe((txt: string) => { msg = txt });
        this.toastr.error(msg, '', {
            timeOut: 3000,
            closeButton: true,
            disableTimeOut: true
        });
    }
}