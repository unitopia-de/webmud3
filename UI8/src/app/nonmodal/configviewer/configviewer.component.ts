import { Component, OnInit } from '@angular/core';
import { MyDynamicComponent } from '../window/my-dynamic.component';

@Component({
  selector: 'app-configviewer',
  templateUrl: './configviewer.component.html',
  styleUrls: ['./configviewer.component.css']
})
export class ConfigviewerComponent extends MyDynamicComponent implements OnInit {

  constructor() { super(); }

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
  onClickMenu(what:string) {
    switch(what){
      case 'colorOff':
        this.mudmcfg.colorOff = !this.mudmcfg.colorOff;
        this.outgoingMsg('colorOff='+this.mudmcfg.colorOff);
        break;
      case 'invert':
        this.mudmcfg.invert = !this.mudmcfg.invert;
        this.outgoingMsg('invert='+this.mudmcfg.invert);
        break;
      case 'blackOnWhite':
        this.mudmcfg.blackOnWhite = !this.mudmcfg.blackOnWhite;
        this.outgoingMsg('blackOnWhite='+this.mudmcfg.blackOnWhite);
        break;
      case 'LocalEcho':
        this.mudmcfg.localEcho = !this.mudmcfg.localEcho;
        this.outgoingMsg('localEcho='+this.mudmcfg.localEcho);
        return;
      case 'displayViewConfig':
          this.outgoingMsg('displayViewConfig=true');
          return;
      case 'closeColorLocalEcho':
          this.outgoingMsg('LocalEchoColor='+this.mudmcfg.colorLocalEcho);
          return;
    }
  }

  ngOnInit() {
  }

}
