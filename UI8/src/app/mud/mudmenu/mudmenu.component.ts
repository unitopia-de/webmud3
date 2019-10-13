import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { WindowConfig } from 'src/app/nonmodal/window-config';
import { WindowsService } from 'src/app/nonmodal/windows.service';
import { GmcpMenu } from 'src/app/gmcp/gmcp-menu';
import { Observable } from 'rxjs';
import { GmcpService } from 'src/app/gmcp/gmcp.service';
import { AnsiService } from '../ansi.service';
import { NGXLogger } from 'ngx-logger';

@Component({
  selector: 'app-mudmenu',
  templateUrl: './mudmenu.component.html',
  styleUrls: ['./mudmenu.component.css']
})
export class MudmenuComponent implements OnInit {

  @Input()  connected: boolean;
  @Input()  portalLogin: boolean;
  @Input() set togglePing(flag :boolean) {
    if (true || flag) {
      this.onPingResponse()
    } 
  }
  get toggleFlag(): string { return this.toggleFlag; }
  @Input() set mud_id(mud_id:string) {
    if (typeof mud_id !=='undefined') {
      this.gmcpobs = this.gmcpsrv.GmcpObservableMenu(mud_id);
      var other = this;
      this.gmcpobs.subscribe(gm => {
        other.gmcpMenu = gm;
        other.gmcpFlag = gm.length>0;
      })
    }
  }
 
  @Output() menuAction= new EventEmitter<string>();

  public mudmcfg = {
    invert:false,
    blackOnWhite:false,
    colorOff:false,
    enablePing:true,
    manualPing:false,
    startPing : new Date(),
    deltaPing:'GMCP-Ping: -',
    colorLocalEcho:'#a8ff00',
    background: '#000000',
    localEcho:true,
  };

  private gmcpobs : Observable<GmcpMenu[]>;
  public gmcpMenu : GmcpMenu[];
  public gmcpFlag : boolean;

  constructor(private wincfg : WindowsService,private gmcpsrv : GmcpService,private logger:NGXLogger,private ansisrv : AnsiService) { }

  onPingResponse() {
    if (this.mudmcfg.manualPing) {
      this.mudmcfg.manualPing = false;
      var stopPing = new Date();
      var delta = stopPing.getTime() - this.mudmcfg.startPing.getTime();
      this.mudmcfg.deltaPing = 'GMCP-Ping: '+delta+' ms';
      this.logger.debug('MudmenuComponent:onPingResponse:',this.mudmcfg.deltaPing);
    }
  }

  onClickGmcpMenu(gmen:GmcpMenu) {
    this.logger.trace('MudmenuComponent:onClickGmcpMenu:',gmen);
    this.gmcpsrv.menuAction(gmen);
  }

  onClickMenu(what:string) {
    this.logger.debug('MudmenuComponent:onClickMenu:',what);
    switch (what) {
      case 'new-window':
        var newwin : WindowConfig = new WindowConfig();
        newwin.visible = true;
        this.wincfg.newWindow(newwin);
        return;
      case 'connect':
        this.menuAction.emit('connect');
        return;
      case 'disconnect':
        this.menuAction.emit('disconnect');
        return;
      case 'loginPortal':
        this.menuAction.emit('loginPortal');
        return;
        case 'displayLog':
            this.menuAction.emit('displayLog');
            return;
        case 'ping':
            this.mudmcfg.startPing = new Date();
            this.mudmcfg.manualPing = true;
            this.mudmcfg.deltaPing = 'GMCP-Ping: -';
            this.menuAction.emit('ping');
            return;
      case 'colorOff':
        this.mudmcfg.colorOff = !this.mudmcfg.colorOff;
        this.menuAction.emit('colorOff='+this.mudmcfg.colorOff);
        break;
      case 'invert':
        this.mudmcfg.invert = !this.mudmcfg.invert;
        this.menuAction.emit('invert='+this.mudmcfg.invert);
        break;
      case 'blackOnWhite':
        this.mudmcfg.blackOnWhite = !this.mudmcfg.blackOnWhite;
        this.menuAction.emit('blackOnWhite='+this.mudmcfg.blackOnWhite);
        break;
      case 'LocalEcho':
        this.mudmcfg.localEcho = !this.mudmcfg.localEcho;
        this.menuAction.emit('localEcho='+this.mudmcfg.localEcho);
        return;
      case 'displayViewConfig':
          this.menuAction.emit('displayViewConfig=true');
          return;
    }
    var inpcol = [this.mudmcfg.colorLocalEcho,this.mudmcfg.background];
    var coltmp : string[] = this.ansisrv.extractColors(undefined,inpcol,this.mudmcfg.blackOnWhite,this.mudmcfg.invert,this.mudmcfg.colorOff);
    this.mudmcfg.colorLocalEcho = coltmp[0];
    this.mudmcfg.background = coltmp[1];
  }

  ngOnInit() {
  }

}
