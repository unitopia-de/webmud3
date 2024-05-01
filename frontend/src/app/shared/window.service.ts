import { Inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { UUID } from 'angular2-uuid';
import { CookieService } from 'ngx-cookie-service';
import { MessageService } from 'primeng/api';
import { WINDOW } from './WINDOW_PROVIDERS';
import { WindowConfig } from './window-config';

@Injectable({
  providedIn: 'root',
})
export class WindowService {
  public windowsconfigurations: WindowConfig[] = [];
  private wincfg: Map<string, WindowConfig> = new Map<string, WindowConfig>();
  // private cmdQueue = new EventEmitter<string>();
  private last_zindex = 100;

  public closeAllWindows() {
    console.debug('WindowsService-closeAllWindows');
    this.windowsconfigurations = [];
    this.wincfg.clear();
    this.last_zindex = 100;
  }
  public closeWindowsPerParent(parentId: string): number {
    if (this.wincfg.get(parentId) === undefined) {
      return 0;
    }
    let count = 0;
    const newcfg: WindowConfig[] = [];
    this.last_zindex = 100;
    this.windowsconfigurations.forEach((cfg) => {
      if (cfg.parentWindow == parentId) {
        count++;
        cfg.inComingEvents.emit('CLOSE_PARENT');
        // cfg.inComingEvents.complete();
        this.wincfg.delete(cfg.windowid);
      } else {
        newcfg.push(cfg);
        if (cfg.zIndex > this.last_zindex) {
          this.last_zindex = cfg.zIndex;
        }
      }
    });
    this.windowsconfigurations = newcfg;
    return count;
  }
  public newWindow(cfg: WindowConfig): string {
    const maxindex = this.windowsconfigurations.length;
    cfg.windowid = UUID.UUID();
    cfg.zIndex = ++this.last_zindex;
    cfg.visible = true;
    cfg.winService = this;
    this.windowsconfigurations.push(cfg);
    this.wincfg.set(cfg.windowid, cfg);
    cfg.outGoingEvents.subscribe((n) => {
      this.OnMenuAction(n, cfg.windowid, this);
    });
    console.debug('newWindow', maxindex, cfg.windowid);
    return cfg.windowid;
  }
  private findWindowByCfg(cfg: WindowConfig): number {
    if (typeof cfg === 'undefined') {
      return -2;
    }
    let i: number;
    for (i = 0; i < this.windowsconfigurations.length; i++) {
      if (this.windowsconfigurations[i].windowid == cfg.windowid) {
        return i;
      }
    }
    return -1;
  }

  public findFilesWindow(cfg: WindowConfig, data: object): WindowConfig {
    if (this.findWindowByCfg(cfg) < 0) {
      cfg = new WindowConfig();
      cfg.component = 'DirlistComponent';
      cfg.save = false;
      cfg.wtitle = 'Verzeichnisanzeige';
      cfg.data = data;
      cfg.windowid = this.newWindow(cfg);
    } else {
      cfg.data = data;
    }
    cfg.dontCancel = false;
    cfg.visible = true;
    // this.OnMenuAction(cfg.windowid+":updateDir",this);
    cfg.inComingEvents.emit('updateDir');
    console.debug('findFilesWindow', cfg);
    return cfg;
  }

  public findCharStatWindow(cfg: WindowConfig, data: object): WindowConfig {
    if (this.findWindowByCfg(cfg) < 0) {
      cfg = new WindowConfig();
      cfg.component = 'CharStatComponent';
      cfg.save = false;
      cfg.wtitle = 'Charakter-Info';
      cfg.data = data;
      cfg.windowid = this.newWindow(cfg);
    } else {
      cfg.data = data;
    }
    cfg.dontCancel = false;
    cfg.visible = true;
    // this.OnMenuAction(cfg.windowid+":updateDir",this);
    cfg.inComingEvents.emit('updateStats');
    console.debug('findCharStatWindow', cfg);
    return cfg;
  }

  public OnMenuAction(event: string, winid: string, other: any) {
    if (!other.wincfg.has(winid)) {
      console.error('OnMenuAction-error:', [event, winid, other.wincfg]);
      return;
    }
    console.log('OnMenuAction:', [event, winid]);
    const cfg: WindowConfig = other.wincfg.get(winid);
    const exp: string[] = event.split(':');
    switch (exp[0]) {
      case 'do_focus':
        other.focus(exp[1]);
        return;
      case 'do_hide':
        other.deleteWindow(winid, other);
        break;
      case 'saved':
        if (exp[1] == 'false') break; // dont close!
        cfg.visible = false;
        break;
      case 'Cancel':
        cfg.visible = false;
        break;
    }
    cfg.inComingEvents.emit(event);
  }

  private deleteWindow(index: number | string, other: any) {
    if (typeof index !== 'number') {
      index = other.findWindowByCfg(
        other.wincfg.get(index as unknown as string),
      );
    }
    console.log('deleteWindow', index, other.windowsconfigurations);
    const maxindex = other.windowsconfigurations.length - 1;
    let zoffset;
    for (let i: number = index as number; i < maxindex; i++) {
      const dwin = other.windowsconfigurations[i + 1];
      zoffset = dwin.initalLock ? 1000 : 100;
      dwin.zIndex = zoffset + i;
      other.windowsconfigurations[i] = dwin;
    }
    other.wincfg.clear();
    other.windowsconfigurations.pop();
    for (let j = 0; j < other.windowsconfigurations.length; j++) {
      const id = other.windowsconfigurations[j].windowid;
      other.wincfg.set(id, other.windowsconfigurations[j]);
    }
  }
  setWindowsSize(innerHeight: number, innerWidth: number) {
    // TODO propagate resizing...
  }

  /**
   * convert cancelSave to cmdqueue
   *
   * @param {string} winid  unique windows id
   * @param {string} reason  reason why save has failed.
   * @memberof WindowsService
   */
  public Cancelled(winid: string) {
    console.debug('Cancelled:', winid);
    this.OnMenuAction('cancelled:', winid, this);
  }
  public CancelSave(winid: string, reason: string) {
    console.debug('CancelSave:', winid, reason);
    this.OnMenuAction('CancelSave:' + reason, winid, this);
  }
  public SavedAndClose(winid: string) {
    console.debug('SavedAndClose:', winid);
    this.OnMenuAction('savedAndClose', winid, this);
  }
  public WinError(winid: string, reason: any) {
    this.messageService.add({
      severity: 'error',
      summary: 'Speichern fehlgeschlagen',
    });
    console.debug('WinError:', winid, reason.message);
    this.OnMenuAction('WinError', winid, this);
  }
  public SaveComplete(winid: string, closable: boolean) {
    console.debug('SaveComplete:', winid);
    this.OnMenuAction('saved:' + closable, winid, this);
  }
  /**
   * view port height
   *
   * @returns {number}
   * @memberof WindowsService
   */
  getViewPortHeight(): number {
    return this.window.innerHeight;
  }

  /**
   * view port width.
   *
   * @returns {number}
   * @memberof WindowsService
   */
  getViewPortWidth(): number {
    return this.window.innerWidth;
  }

  // Remark[myst] unused function
  // private focus(winid: string) {
  //   const cfg: WindowConfig = this.wincfg.get(winid);
  //   console.warn('focus-1', this.windowsconfigurations);
  //   const index = this.findWindowByCfg(cfg);
  //   const maxindex = this.windowsconfigurations.length - 1;
  //   const cwin = this.windowsconfigurations[index];
  //   const zoffset = 100;
  //   for (let i = index; i < maxindex; i++) {
  //     const dwin = this.windowsconfigurations[i + 1];
  //     dwin.zIndex = zoffset + i;
  //     this.windowsconfigurations[i] = dwin;
  //   }
  //   cwin.zIndex = zoffset + maxindex;
  //   this.windowsconfigurations[maxindex] = cwin;
  //   console.warn('focus-2', this.windowsconfigurations);
  // }

  constructor(
    @Inject(WINDOW) private window: Window,
    private cookieService: CookieService,
    private titleService: Title,
    private messageService: MessageService,
  ) {}
}
