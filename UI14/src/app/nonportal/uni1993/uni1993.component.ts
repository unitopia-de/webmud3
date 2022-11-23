import { Component, OnInit } from '@angular/core';
import { WebmudConfig } from '../../mud/webmud-config';
import { ServerConfigService } from '../../shared/server-config.service';

@Component({
  selector: 'app-uni1993',
  templateUrl: './uni1993.component.html',
  styleUrls: ['./uni1993.component.scss']
})
export class Uni1993Component implements OnInit {

  public mudcfg : WebmudConfig = {
    mudname : this.srvcfg.getUni1993Name(),
    autoConnect : true,
    autoLogin : false,
    autoUser : '',
    autoToken:'',
    localEcho : true
  }

  constructor(public srvcfg:ServerConfigService) { }

  ngOnInit() {
  }

}
