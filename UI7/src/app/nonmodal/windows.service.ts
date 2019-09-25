import { Injectable, Inject, EventEmitter } from '@angular/core';
import { WindowConfig } from './window-config';
import { UUID } from 'angular2-uuid';
import { WINDOW } from '../shared/WINDOW_PROVIDERS';
import { Title } from '@angular/platform-browser';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WindowsService {
  setWindowsSize(innerHeight: number, innerWidth: number): any {
    // TODO propagate resizing...
  }
  public windowsconfigurations :WindowConfig[] = [];
  private wincfgIndex = {};
  private cmdQueue = new EventEmitter<string>();

  getViewPortHeight():number {
    return this.window.innerHeight;
  }
  getViewPortWidth():number {
    return this.window.innerWidth;
  }

  public newWindow(cfg : WindowConfig) : string {
    const maxindex = this.windowsconfigurations.length;
    cfg.windowid = UUID.UUID();
    cfg.visible = true;
    this.windowsconfigurations.push(cfg);
    this.focus(maxindex,false);
    console.log("newWindow",maxindex);
    return cfg.windowid;
  }

  public findFilesWindow(cfg : WindowConfig,data:Object) : WindowConfig {
    if (typeof cfg === 'undefined') {
      cfg = new WindowConfig();
      cfg.component = "DirlistComponent";
      cfg.save = false;
      cfg.wtitle = 'Verzeichnisanzeige';
      cfg.data = data;
      cfg.windowid = this.newWindow(cfg);
    } else {
      cfg.data = data;
    }
    cfg.dontCancel = true;
    cfg.visible = true;
    this.cmdQueue.emit(cfg.windowid+":updateDir");
    return cfg;
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
    if (esp.length<2 || typeof this.wincfgIndex[esp[0]] === 'undefined') {
      console.log('windowsService:OnMenuAction-Unknown Event: ',event);
      return;
    }
    const index = this.wincfgIndex[esp[0]];
    // let wincfg = this.windowsconfigurations[index];
    switch(esp[1]) {
      case 'lock':
        this.focus(index,true);
        return;
      case 'unlock':
        this.focus(index,false);
        return;
      case 'save':
        return;
      case 'saved':
      case 'cancel':
        this.deleteWindow(index);
        return;
      default:
        console.log('windowsService:OnMenuAction-Unknown Event-2: ',event);
        return;
    }
  }
  
  public getDownStream() {
    var other = this;
    return new Observable<string>(observer => {
      other.cmdQueue.subscribe(
        (x:string) => observer.next(x), 
        (err:any)=> observer.error(err) ,
        ()=>observer.complete() )
    })
  }
    

  public CancelSave(winid:string,reason:string) {
    this.cmdQueue.emit(winid+":CancelSave:"+reason);
  }
  public SaveComplete(winid:string) {
    this.cmdQueue.emit(winid+":saved");
  }

  public setTitle(tstr:string) {
    this.titleService.setTitle(tstr.substr(0,1).toUpperCase()+tstr.substr(1));
  }


  constructor(@Inject(WINDOW) private window:Window,private titleService:Title) { }
}
