import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PortalService {
  isLoggedIn : boolean = false;
  redirectUrl : string = '/';

  constructor() { }
}
