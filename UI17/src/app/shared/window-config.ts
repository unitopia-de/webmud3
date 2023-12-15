import { EventEmitter } from '@angular/core';

export class WindowConfig {
  windowid = ''; // unique id
  parentWindow = ''; // id of the parent window, if any.
  visible = false;
  wtitle = 'Editor'; // Window title
  tooltip = '';
  initalLock = false; // Initialisation of lock.
  save = false; // saving allowed or not.
  dontCancel = false; // supress cancelbutton
  component = 'EditorComponent';
  zIndex = 0;
  tabID = '';
  posx = 0;
  posy = 0;
  data?: any = undefined;
  winService?: any = undefined;
  outGoingEvents: EventEmitter<string> = new EventEmitter<string>();
  inComingEvents: EventEmitter<string> = new EventEmitter<string>();
}
