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


  /**
   * propaget windows size...
   *
   * @param {number} innerHeight
   * @param {number} innerWidth
   * @returns {*}
   * @memberof WindowsService
   */
  setWindowsSize(innerHeight: number, innerWidth: number): any {
    // TODO propagate resizing...
  }
  public windowsconfigurations :WindowConfig[] = [];
  private wincfgIndex = {};
  private cmdQueue = new EventEmitter<string>();
/**
 * view port height
 *
 * @returns {number}
 * @memberof WindowsService
 */
  getViewPortHeight():number {
    return this.window.innerHeight;
  }


  /**
   * view port width.
   *
   * @returns {number}
   * @memberof WindowsService
   */
  getViewPortWidth():number {
    return this.window.innerWidth;
  }
/**
 *  close all windows e.g. on disconnect.
 *
 * @memberof WindowsService
 */
public closeAllWindows() {
    this.windowsconfigurations = [];
  }
/**
 * create a new window.
 *
 * @param {WindowConfig} cfg  window configuration
 * @returns {string}  the unqiue window id.
 * @memberof WindowsService
 */
public newWindow(cfg : WindowConfig) : string {
    const maxindex = this.windowsconfigurations.length;
    cfg.windowid = UUID.UUID();
    cfg.visible = true;
    this.windowsconfigurations.push(cfg);
    this.focus(maxindex,false);
    console.log("newWindow",maxindex);
    return cfg.windowid;
  }
private findWindowByCfg(cfg:WindowConfig):boolean {
  if (typeof cfg === 'undefined') {
    return true;
  }
  var i: number;
  for (i=0;i< this.windowsconfigurations.length;i++) {
    if (this.windowsconfigurations[i].windowid == cfg.windowid) {
      return false;
    }
  }
  return true;
}
/**
 *  open or connect to directory window.
 *
 * @param {WindowConfig} cfg  window configuration
 * @param {Object} data  data to process
 * @param {number} offsetwidth  initial offset
 * @returns {WindowConfig}  new or changed window configuration
 * @memberof WindowsService
 */
public findFilesWindow(cfg : WindowConfig,data:Object) : WindowConfig {
    if (this.findWindowByCfg(cfg)) {
      cfg = new WindowConfig();
      cfg.component = "DirlistComponent";
      cfg.save = false;
      cfg.wtitle = 'Verzeichnisanzeige';
      cfg.data = data;
      cfg.windowid = this.newWindow(cfg);
    } else {
      cfg.data = data;
    }
    cfg.dontCancel = false;
    cfg.visible = true;
    this.cmdQueue.emit(cfg.windowid+":updateDir");
    console.log('findFilesWindow: ',data);
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
/**
 * pass the menu event to the winndow services... 
 *
 * @param {string} event  windowid : action
 * @returns
 * @memberof WindowsService
 */
public OnMenuAction(event:string) {
    var esp : string[] = event.split(":");
    if (esp.length<2 || typeof this.wincfgIndex[esp[0]] === 'undefined') {
      console.log('windowsService:OnMenuAction-Unknown Event: ',event);
      return;
    }
    const index = this.wincfgIndex[esp[0]];
    let wincfg = this.windowsconfigurations[index];
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
  /**
   * returns an observable on the cmdQueue.
   *
   * @returns  an observable on the cmdQueue.
   * @memberof WindowsService
   */
  public getDownStream() : Observable<string>{
    var other = this;
    return new Observable<string>(observer => {
      other.cmdQueue.subscribe(
        (x:string) => observer.next(x), 
        (err:any)=> observer.error(err) ,
        ()=>observer.complete() )
    })
  }
    
/**
 * convert cancelSave to cmdqueue
 *
 * @param {string} winid  unique windows id
 * @param {string} reason  reason why save has failed.
 * @memberof WindowsService
 */
public CancelSave(winid:string,reason:string) {
    this.cmdQueue.emit(winid+":CancelSave:"+reason);
  }

  /**
   *  indicate, that save was completed.
   *
   * @param {string} winid    the unique windows id
   * @memberof WindowsService
   */
  public SaveComplete(winid:string) {
    this.cmdQueue.emit(winid+":saved");
  }

/**
 *  set the tab title of this window.
 *
 * @param {string} tstr  title to set.
 * @memberof WindowsService
 */
public setTitle(tstr:string) {
    this.titleService.setTitle(tstr.substr(0,1).toUpperCase()+tstr.substr(1));
  }


  constructor(@Inject(WINDOW) private window:Window,private titleService:Title) { }
}
