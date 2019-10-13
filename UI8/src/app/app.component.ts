import { Component, HostListener } from '@angular/core';

import { WindowsService } from './nonmodal/windows.service';
import { NGXLogger } from 'ngx-logger';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  constructor(public wincfg : WindowsService,private logger:NGXLogger) {
    this.onResize();
  }

  OnMenuAction(event:string) {
    this.logger.debug('appComponent-OnMenuAction',event);
    this.wincfg.OnMenuAction(event);
  }
  
  @HostListener('window:resize', ['$event'])
  onResize(event?) {
    this.wincfg.setWindowsSize(window.innerHeight, window.innerWidth);
  } 
}
