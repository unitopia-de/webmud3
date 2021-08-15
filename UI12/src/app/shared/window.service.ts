import { EventEmitter, Inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { CookieService } from 'ngx-cookie-service';
import { UUID } from 'angular2-uuid';
import { LoggerService } from '../logger.service';
import { WindowConfig } from './window-config';
import { WINDOW } from './WINDOW_PROVIDERS';
import { Logger, LoggerLevel } from '../logger';

@Injectable({
  providedIn: 'root'
})
export class WindowService {
  
  public windowsconfigurations :WindowConfig[] = [];
  private wincfg : Map<string,WindowConfig> = new Map<string,WindowConfig>();
  private cmdQueue = new EventEmitter<string>();
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
      this.logger.debug('newWindow',maxindex,cfg.windowid);
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
      this.logger.trace('findFilesWindow',cfg);
      return cfg;
    }

    public OnMenuAction(event:string,winid:string) {
    }

    setWindowsSize(innerHeight: number, innerWidth: number): any {
      // TODO propagate resizing...
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

  constructor(
    @Inject(WINDOW) private window:Window,
    private cookieService : CookieService,
    private loggerSrv : LoggerService,
    private titleService:Title
    ) {
      this.logger = this.loggerSrv.addLogger("WindowService",LoggerLevel.ALL);
     }
}
