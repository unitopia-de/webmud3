import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-mudmenu',
  templateUrl: './mudmenu.component.html',
  styleUrls: ['./mudmenu.component.css']
})
export class MudmenuComponent implements OnInit {

  @Input()  connected: boolean;
  @Input()  portalLogin: boolean;
  @Output() menuAction= new EventEmitter<string>();

  public mudmcfg = {
    invert:false,
    blackOnWhite:false,
  };

  constructor() { }

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
    }
  }

  ngOnInit() {
  }

}
