import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Injectable } from '@angular/core';
import { AuthService } from './_services/auth.service';
import { ProjectService } from './_services/project.service';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(private authService: AuthService,
        private projectService: ProjectService, 
        private router: Router) { }

    canActivate(
        next: ActivatedRouteSnapshot,
        state: RouterStateSnapshot): boolean {
        if (!this.projectService.isSecurityEnabled()) {
            return true;
        }
        if (this.authService.isAdmin()) {
            return true;
        }

        // this.router.navigate(['/home']);
        return false;
    }
}