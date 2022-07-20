import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { MenuService } from 'src/app/menu/menu.service';
import { MenuType } from 'src/app/menu/one-menu';
import { ReadLanguageService } from 'src/app/read-language.service';
import { SocketsService } from 'src/app/shared/sockets.service';

@Component({
  selector: 'app-mudmenu',
  templateUrl: './mudmenu.component.html',
  styleUrls: ['./mudmenu.component.css']
})
export class MudmenuComponent implements OnInit {

  @Input() set connected(conn:boolean) {
    if (this._connected != conn) {
      this._connected = conn;
      this.refreshMenu();
    }
  } get connected():boolean {return this._connected};

  @Input() set scrollLock(conn:boolean) {
    if (this._scroll != conn) {
      this._scroll = conn;
      this.refreshMenu();
    }
  } get scrollLock():boolean {return this._connected};

  @Input() set mud_id(mud_id:string) {
    if (typeof mud_id !=='undefined') {
      this._mudID = mud_id;
      var myMenuId = 'MUD_CLIENT:'+mud_id;
      if (this.menuID != myMenuId) {
        this.items = undefined;
        this.refreshMenu(true);
      }
    }
  } get mud_id():string {return this._mudID}
 
  @Input() set mud_name(mud_name:string) {
    if (typeof mud_name !=='undefined') {
      this.mudName = mud_name;
    }
  } get mud_name():string {return this._mudID}

  @Output() menuAction= new EventEmitter<any>();

  public items: MenuItem[];
  private menuID : string;
  private mudName: string;
  private noMudnames:boolean=false;
  private _mudID : string;
  private _connected:boolean=false;
  private _scroll:boolean=false;

  constructor(
    private i18n:ReadLanguageService,
    private menuSrv:MenuService,
    private socketSrv:SocketsService
  ) { }

  menuEvent(event) {
    //event.originalEvent: Browser event
    //event.item: menuitem metadata
    if (this.mudName == '' && this.noMudnames && typeof this.socketSrv.mudlist !== 'undefined') {
      console.log("menu-event-1",event,this.mudName);
      this.refreshMenu(false);
    } else {
      console.log("menu-event-2",event,this.mudName);
      this.menuAction.next(event); // pass through to parent node.
    }
  }

  refreshMenu(initial:boolean=false) {
    var other = this;
    if (initial) {
      this.menuSrv.create_menu(
        MenuType.MUD_CLIENT,
        this.menuID,
        function(event) {other.menuEvent(event);} );
    }
    this.menuSrv.refresh_menu(this.menuID);
    this.menuSrv.add_menu_item(
      this.menuID,
      0,
      'MUD:MENU',
      this.i18n.get('MUD'),
      'pi pi-power-off'
    );
    console.log("add-menu '"+this.mudName+"'",this.socketSrv.mudlist);
    if (this.mudName != '') {
      this.menuSrv.add_menu_item(
        this.menuID,
        1,
        'MUD:CONNECT',
        this.i18n.get('Verbinden'),
        'pi pi-sign-in',
        this._connected,true
      );
    } else {
      if (typeof this.socketSrv.mudlist !== 'undefined') {
        this.socketSrv.mudlist.forEach(m => {
          this.menuSrv.add_menu_item(
            this.menuID,
            1,
            'MUD:CONNECT:'+m.key,
            m.name,
            'pi pi-sign-in',
            this._connected,true
          );
        })
      } else {
        this.noMudnames = true;
      }
    }
    this.menuSrv.add_menu_item(
      this.menuID,
      1,
      'MUD:DISCONNECT',
      this.i18n.get('Trennen'),
      'pi pi-sign-out',
      !this._connected,true
    );
    this.menuSrv.add_menu_item(
      this.menuID,
      1,
      'MUD:NUMPAD',
      this.i18n.get('Numpad'),
      'pi pi-key',
      !this._connected,true
    );
    this.menuSrv.add_menu_item(
      this.menuID,
      0,
      'MUD:VIEW',
      this.i18n.get('Farben'),
      'pi pi-eye'
    );
    this.menuSrv.add_menu_item(
      this.menuID,
      0,
      'MUD:SCROLL',
      this.i18n.get('Scroll'),
      this._scroll ? 'pi pi-play' : 'pi pi-pause'
    );
    this.items = this.menuSrv.get_menu_items(this.menuID);
  }

  ngOnInit(): void {
  }

}
// TODO help: pi-question-circle webmud3 hilfe, befehle spieler und goetter und enzy.