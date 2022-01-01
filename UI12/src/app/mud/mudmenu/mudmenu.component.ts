import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { MenuService } from 'src/app/menu/menu.service';
import { MenuType } from 'src/app/menu/one-menu';
import { ReadLanguageService } from 'src/app/read-language.service';

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
 
  @Output() menuAction= new EventEmitter<any>();

  public items: MenuItem[];
  private menuID : string;
  private _mudID : string;
  private _connected:boolean=false;
  private _scroll:boolean=false;

  constructor(
    private i18n:ReadLanguageService,
    private menuSrv:MenuService
  ) { }

  menuEvent(event) {
    //event.originalEvent: Browser event
    //event.item: menuitem metadata
    // console.log("menu-event",event);
    this.menuAction.next(event); // pass through to parent node.
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
    this.menuSrv.add_menu_item(
      this.menuID,
      1,
      'MUD:CONNECT',
      this.i18n.get('Verbinden'),// TODO connect TO menu of muds
      'pi pi-sign-in',
      this._connected,true
    );
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
      this._scroll ? 'pi pi-arrow-circle-down' : 'pi pi-arrow-circle-up'
    );
    this.items = this.menuSrv.get_menu_items(this.menuID);
  }

  ngOnInit(): void {
  }

}
// TODO help: pi-question-circle webmud3 hilfe, befehle spieler und goetter und enzy.