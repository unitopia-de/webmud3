import { Injectable } from '@angular/core';
import { WindowConfig } from './window-config';

@Injectable({
  providedIn: 'root'
})
export class WindowsService {
  public windowsconfigurations :WindowConfig[] = [];
  private wincfgIndex = {}

  public newWindow(cfg : WindowConfig) {

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
    var zoffset;
    for(var i = index; i < maxindex; i++) {
      var dwin = this.windowsconfigurations[i+1];
      zoffset = (dwin.initalLock) ? 1000 : 100;
      dwin.zIndex = zoffset + i;
      this.windowsconfigurations[i] = dwin;
    }
    this.windowsconfigurations.pop();
    for (var j = 0;j <= maxindex;j++) {
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
    }
  }

  constructor() { }
}
