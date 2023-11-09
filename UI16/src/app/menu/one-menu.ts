import { MenuItem } from 'primeng/api';

export class OneMenu {
  menuType: MenuType = MenuType.OTHER;
  menuID: string;
  items: MenuItem[] = [];
  /* eslint @typescript-eslint/ban-types: "warn" */
  executer: Function;
  constructor(type: MenuType, id: string, callback: Function) {
    this.menuType = type;
    this.menuID = id;
    this.executer = callback;
  }
}

export enum MenuType {
  OTHER = 'OTHER',
  MUD_CLIENT = 'MUD_CLIENT',
  EDITOR = 'EDITOR',
}
