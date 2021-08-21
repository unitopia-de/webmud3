import { EventEmitter, Inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { CookieService } from 'ngx-cookie-service';
import { UUID } from 'angular2-uuid';
import { LoggerService } from '../logger.service';
import { WindowConfig } from './window-config';
import { WINDOW } from './WINDOW_PROVIDERS';
import { Logger, LoggerLevel } from '../logger';
import {MessageService} from 'primeng/api';

@Injectable({
  providedIn: 'root'
})
export class WindowService {
  
  public windowsconfigurations :WindowConfig[] = [];
  private wincfg : Map<string,WindowConfig> = new Map<string,WindowConfig>();
  // private cmdQueue = new EventEmitter<string>();
  private last_zindex = 100;
  private logger : Logger;

  public closeAllWindows() {
    this.logger.debug('WindowsService-closeAllWindows');
    this.windowsconfigurations = [];
    this.wincfg.clear();
    this.last_zindex = 100;
  }
  public closeWindowsPerParent(parentId:string) : number {
    if (this.wincfg.get(parentId) === undefined) {
      return 0;
    }
    var count = 0;
    var newcfg :WindowConfig[]=[];
    this.last_zindex = 100;
    this.windowsconfigurations.forEach(cfg => {
      if (cfg.parentWindow == parentId) {
        count++;
        cfg.inComingEvents.next("CLOSE_PARENT");
        cfg.inComingEvents.complete();
        this.wincfg.delete(cfg.windowid);
      }
      else
      {
        newcfg.push(cfg);
        if (cfg.zIndex > this.last_zindex) {
          this.last_zindex = cfg.zIndex;
        }
      }
    });
    this.windowsconfigurations = newcfg;
    return count;
  }
  public newWindow(cfg : WindowConfig) : string {
      const maxindex = this.windowsconfigurations.length;
      cfg.windowid = UUID.UUID();
      cfg.zIndex = ++this.last_zindex;
      cfg.visible = true;
      this.windowsconfigurations.push(cfg);
      this.wincfg.set(cfg.windowid,cfg);
      var other = this;
      cfg.outGoingEvents.subscribe(n => {
        other.OnMenuAction(n,cfg.windowid);
      })
      this.logger.debug('newWindow',maxindex,cfg.windowid);
      return cfg.windowid;
    }
    private findWindowByCfg(cfg:WindowConfig):number {
      if (typeof cfg === 'undefined') {
        return -2;
      }
      var i: number;
      for (i=0;i< this.windowsconfigurations.length;i++) {
        if (this.windowsconfigurations[i].windowid == cfg.windowid) {
          return i;
        }
      }
      return -1;
    }

    public findFilesWindow(cfg : WindowConfig,data:Object) : WindowConfig {
      if (this.findWindowByCfg(cfg)<0) {
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
      // this.OnMenuAction(cfg.windowid+":updateDir");
      cfg.inComingEvents.emit('updateDir');
      this.logger.trace('findFilesWindow',cfg);
      return cfg;
    }

    public OnMenuAction(event:string,winid:string) {
      if (!this.wincfg.has(winid)) {
        this.logger.error("OnMenuAction-error:",[event,winid,this.wincfg]);
        return;
      }
      this.logger.log("OnMenuAction:",[event,winid]);
      const cfg :WindowConfig = this.wincfg.get(winid);
      const exp :string[]= event.split(":");
      switch (exp[0]) {
        case "do_focus":
          this.focus(exp[1]);
          return;
        case "do_hide":
          this.deleteWindow(winid);
        case "saved":
          if (exp[1]=="false") break; // dont close!
          cfg.visible = false;
          break;
        case "Cancel":
          cfg.visible = false;
          break;
      }
      cfg.inComingEvents.emit(event);
    }
  
  private deleteWindow(index : number|string) {
    if (typeof index === 'number') {
      index = this.findWindowByCfg(this.wincfg.get(index as unknown as string));
    }
    var maxindex = this.windowsconfigurations.length-1;
    var cwin = this.windowsconfigurations[index];
    cwin.visible = false;
    var zoffset;
    for(var i : number = (index as number); i < maxindex; i++) {
      var dwin = this.windowsconfigurations[i+1];
      zoffset = (dwin.initalLock) ? 1000 : 100;
      dwin.zIndex = zoffset + i;
      this.windowsconfigurations[i] = dwin;
    }
    this.wincfg.clear();
    this.windowsconfigurations.pop();
    for (var j = 0;j < this.windowsconfigurations.length;j++) {
      var id = this.windowsconfigurations[j].windowid;
      this.wincfg.set(id,this.windowsconfigurations[j]);
    }
  } 
    setWindowsSize(innerHeight: number, innerWidth: number): any {
      // TODO propagate resizing...
    }

    
/**
 * convert cancelSave to cmdqueue
 *
 * @param {string} winid  unique windows id
 * @param {string} reason  reason why save has failed.
 * @memberof WindowsService
 */
public Cancelled(winid:string) {
  this.logger.debug('Cancelled:',winid);
  this.OnMenuAction("cancelled:",winid);
}
public CancelSave(winid:string,reason:string) {
  this.logger.debug('CancelSave:',winid,reason);
  this.OnMenuAction("CancelSave:"+reason,winid);
}
public SavedAndClose(winid:string) {
  this.logger.debug('SavedAndClose:',winid);
  this.OnMenuAction("savedAndClose",winid);
}
public WinError(winid:string,reason:any) {
  this.messageService.add({severity:'error', summary:'Speichern fehlgeschlagen'});
  this.logger.debug('WinError:',winid,reason.message);
  this.OnMenuAction("WinError",winid);
}
  public SaveComplete(winid:string,closable:boolean) {
    this.logger.debug('SaveComplete:',winid);
    this.OnMenuAction("saved:"+closable,winid);
  }
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

private focus(winid:string) {
  const cfg :WindowConfig = this.wincfg.get(winid);
  this.logger.warn("focus-1",this.windowsconfigurations);
  const index = this.findWindowByCfg(cfg);
  var maxindex = this.windowsconfigurations.length-1;
  var cwin = this.windowsconfigurations[index];
  var zoffset=100;
  for(var i = index; i < maxindex; i++) {
    var dwin = this.windowsconfigurations[i+1];
    dwin.zIndex = zoffset + i;
    this.windowsconfigurations[i] = dwin;
  }
  cwin.zIndex = zoffset + maxindex;
  this.windowsconfigurations[maxindex] = cwin;
  this.logger.warn("focus-2",this.windowsconfigurations);
}


  constructor(
    @Inject(WINDOW) private window:Window,
    private cookieService : CookieService,
    private loggerSrv : LoggerService,
    private titleService:Title,
    private messageService:MessageService
    ) {
      this.logger = this.loggerSrv.addLogger("WindowService",LoggerLevel.ALL);
     }
}
