import { Injectable } from '@angular/core';
import { MenuItem, MenuItemCommandEvent } from 'primeng/api';
import { MenuType, OneMenu } from './one-menu';

/* eslint @typescript-eslint/ban-types: "warn" */
@Injectable({
  providedIn: 'root',
})
export class MenuService {
  private all_menus: { [key: string]: OneMenu } = ({} = {});

  create_menu(menuType: MenuType, menuID: string, callback: Function): boolean {
    if (Object.prototype.hasOwnProperty.call(this.all_menus, menuID)) {
      return false;
    }
    const myMenu = new OneMenu(menuType, menuID, callback);
    this.all_menus[menuID] = myMenu;
    return true;
  }
  refresh_menu(menuID: string): boolean {
    if (Object.prototype.hasOwnProperty.call(this.all_menus, menuID)) {
      this.all_menus[menuID].items = [];
      return true;
    }
    return false;
  }
  get_menu_items(menuID: string): MenuItem[] {
    if (Object.prototype.hasOwnProperty.call(this.all_menus, menuID)) {
      return this.all_menus[menuID].items;
    }
    return [];
  }
  add_menu_item(
    menuID: string,
    submenu: number,
    itemId: string,
    label: string,
    icon: string,
    disabled = false,
    visible = true,
  ): boolean {
    if (!Object.prototype.hasOwnProperty.call(this.all_menus, menuID)) {
      return false;
    }
    const myItem: MenuItem = {
      id: itemId,
      label: label,
      icon: icon,
      disabled: disabled,
      visible: visible,
      command: (event: MenuItemCommandEvent) =>
        this.all_menus[menuID].executer(event),
    };
    if (submenu <= 0) {
      if (
        !Object.prototype.hasOwnProperty.call(this.all_menus[menuID], 'items')
      ) {
        this.all_menus[menuID].items = [];
      }
      this.all_menus[menuID].items.push(myItem);
      return true;
    }
    if (
      !Object.prototype.hasOwnProperty.call(this.all_menus[menuID], 'items')
    ) {
      return false; // no previous element to insert to.
    }
    const ix1 = this.all_menus[menuID].items.length - 1;
    if (submenu == 1) {
      if (
        !Object.prototype.hasOwnProperty.call(
          this.all_menus[menuID].items[ix1],
          'items',
        )
      ) {
        this.all_menus[menuID].items[ix1].items = [];
      }
      this.all_menus[menuID]?.items[ix1]?.items?.push(myItem);
      return true;
    }
    if (
      !Object.prototype.hasOwnProperty.call(
        this.all_menus[menuID].items[ix1],
        'items',
      )
    ) {
      return false; // no previous element on level 1 to insert to
    }

    const ix2 = this.all_menus[menuID]?.items[ix1]?.items?.length;

    if (submenu == 2 && ix2 !== undefined) {
      if (
        !Object.prototype.hasOwnProperty.call(
          this.all_menus[menuID]?.items[ix1]?.items?.[ix2],
          'items',
        )
      ) {
        this.all_menus[menuID]!.items[ix1]!.items![ix2].items = [];
      }

      this.all_menus[menuID]?.items[ix1]?.items?.[ix2]?.items?.push(myItem);

      return true;
    }
    return false; // only submenu level 0,1,2 is valid.
  }
}
