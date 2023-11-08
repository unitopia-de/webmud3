import { Component, OnInit } from '@angular/core';
import { ServerConfigService } from 'src/app/shared/server-config.service';
import { WebmudConfig } from 'src/app/mud/webmud-config';

@Component({
  selector: 'app-dual',
  templateUrl: './dual.component.html',
  styleUrls: ['./dual.component.scss'],
})
export class DualComponent {
  public mudcfg1: WebmudConfig = {
    mudname: '',
    autoConnect: false,
    autoLogin: false,
    autoUser: '',
    autoToken: '',
    localEcho: true,
  };
  public mudcfg2: WebmudConfig = {
    mudname: '',
    autoConnect: false,
    autoLogin: false,
    autoUser: '',
    autoToken: '',
    localEcho: true,
  };

  constructor(public srvcfg: ServerConfigService) {}
}
