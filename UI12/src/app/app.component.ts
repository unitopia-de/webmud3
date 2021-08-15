import { Component, HostListener } from '@angular/core';
import { LoggerService } from './logger.service';
import { WindowService } from './shared/window.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  constructor(public wincfg : WindowService,private logger:LoggerService) {
    this.onResize();
  }

  OnMenuAction(event:string,winid:string) {
    this.logger.debug('appComponent-OnMenuAction',event,winid);
    this.wincfg.OnMenuAction(event,winid);
  }

  @HostListener('window:resize', ['$event'])
  onResize(event?) {
    this.wincfg.setWindowsSize(window.innerHeight, window.innerWidth);
  } 

  title = 'UI11';
}
