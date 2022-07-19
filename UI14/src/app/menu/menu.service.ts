import { Injectable } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { MenuType, OneMenu } from './one-menu';

@Injectable({
  providedIn: 'root'
})
export class MenuService {

  private all_menus = {};

  create_menu(menuType:MenuType,id:string,callback:Function):boolean{
    if (this.all_menus.hasOwnProperty(id)) {
      return false;
    }
    var myMenu = new OneMenu(menuType,id,callback);
    this.all_menus[id] = myMenu;
    return true;
  }
  refresh_menu(menuID:string):boolean {
    if (this.all_menus.hasOwnProperty(menuID)) {
      this.all_menus[menuID].items = [];
      return true;
    }
    return false;
  }
  get_menu_items(menuId:string) : MenuItem[] {
    if (this.all_menus.hasOwnProperty(menuId))  {
      return this.all_menus[menuId].items;
    }
    return [];
  }
  add_menu_item(
      menuId:string,
      submenu:number,
      itemId:string,
      label:string,
      icon:string,
      disabled:boolean=false,
      visible:boolean=true):boolean{
    if (!this.all_menus.hasOwnProperty(menuId)) {
      return false;
    }
    var myItem : MenuItem = {
      id:itemId,
      label : label,
      icon: icon,
      disabled: disabled,
      visible: visible,
      command: this.all_menus[menuId].executer
    }
    if (submenu <= 0) {
      if (!this.all_menus[menuId].hasOwnProperty('items')) {
        this.all_menus[menuId].items = [];
      }
      this.all_menus[menuId].items.push(myItem);
      return true;
    }
    if (!this.all_menus[menuId].hasOwnProperty('items')) {
      return false; // no previous element to insert to.
    }
    var ix1 = this.all_menus[menuId].items.length - 1;
    if (submenu == 1) {
      if (!this.all_menus[menuId].items[ix1].hasOwnProperty('items')) {
        this.all_menus[menuId].items[ix1].items = [];
      }
      this.all_menus[menuId].items[ix1].items.push(myItem);
      return true;
    }
    if (!this.all_menus[menuId].items[ix1].hasOwnProperty('items')) {
      return false;// no previous element on level 1 to insert to
    }
    var ix2 = this.all_menus[menuId].items[ix1].items.length;
    if (submenu == 2) {
      if (!this.all_menus[menuId].items[ix1].items[ix2].hasOwnProperty('items')) {
        this.all_menus[menuId].items[ix1].items[ix2].items = [];
      }
      this.all_menus[menuId].items[ix1].items[ix2].items.push(myItem);
      return true;
    }
    return false; // only submenu level 0,1,2 is valid.
  }

  constructor() { }
}
