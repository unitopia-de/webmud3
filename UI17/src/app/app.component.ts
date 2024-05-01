import { Component, HostListener } from '@angular/core';
import { WindowService } from './shared/window.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  constructor(public wincfg: WindowService) {
    this.onResize();
  }

  OnMenuAction(event: string, winid: string, other: any) {
    console.debug('appComponent-OnMenuAction', event, winid);
    this.wincfg.OnMenuAction(event, winid, other);
  }

  @HostListener('window:resize', ['$event'])
  onResize(event?) {
    this.wincfg.setWindowsSize(window.innerHeight, window.innerWidth);
  }

  title = 'webmud3/UI12';
}
