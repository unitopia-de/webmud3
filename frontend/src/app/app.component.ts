import { Component, HostListener } from '@angular/core';
import { WebmudConfig } from '@mudlet3/frontend/core';
import { ServerConfigService } from './shared/server-config.service';
import { WindowService } from './shared/window.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  public mudcfg: WebmudConfig = {
    mudname: this.srvcfg.getUNItopiaName(),
    autoConnect: true,
    autoLogin: false,
    autoUser: '',
    autoToken: '',
    localEcho: true,
  };

  constructor(
    public wincfg: WindowService,
    public srvcfg: ServerConfigService,
  ) {
    this.onResize();
  }

  OnMenuAction(event: string, winid: string, other: any) {
    console.debug('appComponent-OnMenuAction', event, winid);
    this.wincfg.OnMenuAction(event, winid, other);
  }

  @HostListener('window:resize', ['$event'])
  onResize(event?: undefined) {
    this.wincfg.setWindowsSize(window.innerHeight, window.innerWidth);
  }

  title = 'webmud3/UI12';
}
