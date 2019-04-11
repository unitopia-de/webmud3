import { Component, HostListener } from '@angular/core';

import { WindowsService } from './nonmodal/windows.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  constructor(public wincfg : WindowsService) {
    this.onResize();
  }

  OnMenuAction(event:string) {
    console.log(event);
    this.wincfg.OnMenuAction(event);
  }
  
  @HostListener('window:resize', ['$event'])
  onResize(event?) {
    this.wincfg.setWindowsSize(window.innerHeight, window.innerWidth);
  } 
}
