import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Injectable } from '@angular/core';
import { AuthService } from './_services/auth.service';
import { ProjectService } from './_services/project.service';
import { ToastrService } from 'ngx-toastr';
import { TranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { map, mergeMap, switchMap } from 'rxjs/operators';
import { LoginComponent } from './login/login.component';
import { MatDialog } from '@angular/material/dialog';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(private authService: AuthService,
        private translateService: TranslateService,
        private toastr: ToastrService,
        private projectService: ProjectService,
        private dialog: MatDialog,
        private router: Router) {
        }

    canActivate(next: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
        if (!this.projectService.isSecurityEnabled()) {
            return of(true);
        }
        if (this.authService.isAdmin()) {
            return of(true);
        }

        const serverSecureEnabled$ = this.projectService.checkServer().pipe(
            map(response => {
                if (!response?.secureEnabled) {
                    return false;
                }
                return true;
            })
        );
        return serverSecureEnabled$.pipe(
            switchMap(secureEnabled => {
                if (!secureEnabled) {
                    return of(true);
                } else {
                    const dialogRef = this.dialog.open(LoginComponent);
                    return dialogRef.afterClosed().pipe(
                        mergeMap(result => {
                            if (result) {
                                if (this.authService.isAdmin()) {
                                    return of(true);
                                }
                            }
                            this.notifySaveError('msg.signin-unauthorized');
							this.router.navigateByUrl('/');
                            return of(false);
                        })
                    );
                }
            })
        );
    }

    private notifySaveError(textKey: string) {
        let msg = '';
        this.translateService.get(textKey).subscribe((txt: string) => { msg = txt; });
        this.toastr.error(msg, '', {
            timeOut: 3000,
            closeButton: true,
            disableTimeOut: true
        });
    }
}
