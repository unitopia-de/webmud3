import { EventEmitter } from '@angular/core';
import { FileInfo } from '../mud/mud-signals';

export class WindowConfig {
    windowid : string = ''; // unique id
    parentWindow: string = ''; // id of the parent window, if any.
    visible : boolean = false;
    wtitle : string = 'Editor'; // Window title
    tooltip : string = '';
    initalLock : boolean = false; // Initialisation of lock.
    save:boolean=false; // saving allowed or not.
    dontCancel:boolean=false; // supress cancelbutton
    component:string='EditorComponent';
    zIndex : number = 0;
    tabID : string = '';
    posx : number = 0;
    posy : number = 0;
    data?: any = undefined;
    winService: any = undefined;
    outGoingEvents : EventEmitter<string> = new EventEmitter<string>();
    inComingEvents : EventEmitter<string> = new EventEmitter<string>();
}
