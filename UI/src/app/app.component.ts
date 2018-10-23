import { Component, HostListener } from '@angular/core';

import { ConfigService } from './shared/config.service';
import { WindowConfig } from './nonmodal/window-config';
import { WindowsService } from './nonmodal/windows.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  constructor(private cfgsrv : ConfigService,public wincfg : WindowsService) {
    this.onResize();
  }

  OnMenuAction(event:string) {
    this.wincfg.OnMenuAction(event);
  }
  
  @HostListener('window:resize', ['$event'])
  onResize(event?) {
    this.cfgsrv.setWindowsSize(window.innerHeight, window.innerWidth);
  } 
}
