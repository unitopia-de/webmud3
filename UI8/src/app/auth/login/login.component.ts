import { Component, OnInit } from '@angular/core';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

  public logonname : string = '';
  public password : string = '';
  public msg : string = '';

  constructor(public authService: AuthService) { }

  ngOnInit() {
  }

  doLogin() {
    var other = this;
    this.authService.logon(this.logonname,this.password,function(err,data){
      if (typeof err !== 'undefined') {
        other.msg = err;
      } else {
        other.msg ='';
        other.logonname = data.logonname;
      }
      other.password = '';
    })
  }

}
