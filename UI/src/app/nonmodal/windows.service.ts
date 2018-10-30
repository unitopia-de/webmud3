import { Injectable, Inject } from '@angular/core';
import { WindowConfig } from './window-config';
import { UUID } from 'angular2-uuid';
import { WINDOW } from '../shared/WINDOW_PROVIDERS';

@Injectable({
  providedIn: 'root'
})
export class WindowsService {
  setWindowsSize(innerHeight: number, innerWidth: number): any {
    // TODO propagate resizing...
  }
  public windowsconfigurations :WindowConfig[] = [];
  private wincfgIndex = {};

  getViewPortHeight():number {
    return this.window.innerHeight;
  }
  getViewPortWidth():number {
    return this.window.innerWidth;
  }

  public newWindow(cfg : WindowConfig) {
    const maxindex = this.windowsconfigurations.length;
    cfg.windowid = UUID.UUID();
    this.windowsconfigurations.push(cfg);
    this.focus(maxindex,false);
  }

  private focus(index : number,targetLock : boolean) {
    var maxindex = this.windowsconfigurations.length-1;
    var cwin = this.windowsconfigurations[index];
    var zoffset;
    for(var i = index; i < maxindex; i++) {
      var dwin = this.windowsconfigurations[i+1];
      zoffset = (dwin.initalLock) ? 1000 : 100;
      dwin.zIndex = zoffset + i;
      this.windowsconfigurations[i] = dwin;
    }
    cwin.initalLock = targetLock;
    zoffset = (cwin.initalLock) ? 1000 : 100;
    cwin.zIndex = zoffset + maxindex;
    this.windowsconfigurations[maxindex] = cwin;
    this.wincfgIndex = {};
    for (var j = 0;j <= maxindex;j++) {
      var id = this.windowsconfigurations[j].windowid;
      this.wincfgIndex[id] = j;
    }
  }

  private deleteWindow(index : number) {
    var maxindex = this.windowsconfigurations.length-1;
    var cwin = this.windowsconfigurations[index];
    cwin.visible = false;
    var zoffset;
    for(var i = index; i < maxindex; i++) {
      var dwin = this.windowsconfigurations[i+1];
      zoffset = (dwin.initalLock) ? 1000 : 100;
      dwin.zIndex = zoffset + i;
      this.windowsconfigurations[i] = dwin;
    }
    this.windowsconfigurations.pop();
    for (var j = 0;j < this.windowsconfigurations.length;j++) {
      var id = this.windowsconfigurations[j].windowid;
      this.wincfgIndex[id] = j;
    }
  }

  public OnMenuAction(event:string) {
    var esp : string[] = event.split(":");
    if (esp.length!=2 || typeof this.wincfgIndex[esp[0]] === 'undefined') {
      console.log('Unknown Event: '+event);
      return;
    }
    const index = this.wincfgIndex[esp[0]];
    switch(esp[1]) {
      case 'lock':
        this.focus(index,true);
        return;
      case 'unlock':
        this.focus(index,false);
        return;
      case 'save':
      case 'cancel':
        this.deleteWindow(index);
        return;
    }
  }



  constructor(@Inject(WINDOW) private window:Window) { }
}
