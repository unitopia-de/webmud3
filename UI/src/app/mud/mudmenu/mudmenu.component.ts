import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';

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
 
  @Output() menuAction= new EventEmitter<string>();

  public mudmcfg = {
    invert:false,
    blackOnWhite:false,
    enablePing:true,
    manualPing:false,
    startPing : new Date(),
    deltaPing:'GMCP-Ping: -',
  };

  constructor() { }

  onPingResponse() {
    if (this.mudmcfg.manualPing) {
      this.mudmcfg.manualPing = false;
      var stopPing = new Date();
      var delta = stopPing.getTime() - this.mudmcfg.startPing.getTime();
      this.mudmcfg.deltaPing = 'GMCP-Ping: '+delta+' ms';
    }
  }

  onClickMenu(what:string) {
    switch (what) {
      case 'connect':
        this.menuAction.emit('connect');
        return;
      case 'disconnect':
        this.menuAction.emit('disconnect');
        return;
      case 'loginPortal':
        this.menuAction.emit('loginPortal');
        return;
      case 'invert':
        this.mudmcfg.invert = !this.mudmcfg.invert;
        this.menuAction.emit('invert='+this.mudmcfg.invert);
        return;
      case 'blackOnWhite':
        this.mudmcfg.blackOnWhite = !this.mudmcfg.blackOnWhite;
        this.menuAction.emit('blackOnWhite='+this.mudmcfg.blackOnWhite);
        return;
      case 'ping':
        this.mudmcfg.startPing = new Date();
        this.mudmcfg.manualPing = true;
        this.mudmcfg.deltaPing = 'GMCP-Ping: -';
        this.menuAction.emit('ping');
        return;
    }
  }

  ngOnInit() {
  }

}
