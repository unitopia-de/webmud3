import { Injectable }     from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot }    from '@angular/router';
import { PortalService } from './shared/portal.service';

@Injectable()
export class NonPortalGuard implements CanActivate {
  constructor(private portalService: PortalService,private router: Router) {

  }
canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean  {
  // console.log('NonPortalGuard#canActivate called');
  return this.checkLogOut();
}

checkLogOut(): boolean {
  if (this.portalService.isLoggedIn !== true) { return true; }
  return false;
}
}