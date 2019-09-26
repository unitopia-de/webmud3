import { Injectable }     from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router }    from '@angular/router';
import { PortalService } from './shared/portal.service';

@Injectable()
export class PortalGuard implements CanActivate {
    constructor(private portalService: PortalService,private router: Router) {

    }
  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean  {
    console.log('PortalGuard#canActivate called');
    
    let url: string = state.url;
    return this.checkLogin(url);
  }

  checkLogin(url: string): boolean {
    if (this.portalService.isLoggedIn) { return true; }
    this.portalService.redirectUrl = url;
    this.router.navigate(['/login']);
    return false;
  }
}