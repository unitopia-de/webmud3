import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ServerConfigService } from '../shared/server-config.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private redirectUrl : string = '';
  private request :string = '';
  private requestMsg : string = '';
  private loggedOn : string = '';
  private logonname : string = '';

  public isAdminLoggedOn() : boolean {
    return this.loggedOn == 'admin';
  }
  public isLoggedOn() : boolean {
    return this.loggedOn != '';
  }

  public requestAdminLogin(url:string,msg:string) {
    this.redirectUrl = url;
    this.request = 'admin';
    this.requestMsg = msg;
    this.router.navigate(['/login']);
  }

  public requestUserLogin(url:string,msg:string) {
    this.redirectUrl = url;
    this.request = 'user';
    this.requestMsg = msg;
    this.router.navigate(['/login']);
  }

  public logout() {
    this.redirectUrl = '';
    this.request = '';
    this.requestMsg = '';
    this.loggedOn = '';
    this.logonname = '';
    return this.http.post(this.srvcfg.getApiUrl() + 'auth/logout', {
    }, {
      withCredentials: true
    }).subscribe((resp:any)=>{

    },(errResp:any)=>{

    });
  }

  public logon(usr:string,pw:string,cb) {
    return this.http.post(this.srvcfg.getApiUrl() + 'auth/login', {
      logonname: usr,
      password: pw,
    }, {
      withCredentials: true
    }).subscribe((resp: any) => {
      switch(this.request) {
        case 'admin':
          this.logonname = resp.logonname;
          if (resp.adminp) {
            this.loggedOn = 'admin';
            cb(undefined,resp);
            this.router.navigate([this.redirectUrl]);
          } else {
            this.loggedOn = 'user';
            cb(this.requestMsg,undefined);
          }
          return;
        default:
        case 'user':
            this.loggedOn = 'user';
            this.logonname = resp.logonname;
            cb(undefined,resp);
            this.router.navigate([this.redirectUrl]);
            return;
      }
    }, (errorResp) => {
      cb(errorResp.error,undefined);
    });
  }

  constructor(private http: HttpClient,private router: Router,private srvcfg:ServerConfigService) { }
}
