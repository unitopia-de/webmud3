import { Component, HostListener } from '@angular/core';

import { ConfigService } from './shared/config.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'app';

  constructor(private cfgsrv : ConfigService) {
    this.onResize();
  }
  
  @HostListener('window:resize', ['$event'])
  onResize(event?) {
    this.cfgsrv.setWindowsSize(window.innerHeight, window.innerWidth);
  } 
}
