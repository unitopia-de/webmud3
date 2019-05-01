export class WindowConfig {
    windowid : string = ''; // unique id
    visible : boolean = false;
    wtitle : string = 'Editor'; // Window title
    initalLock : boolean = false; // Initialisation of lock.
    save:boolean=false; // saving allowed or not.
    component:string='SimpleEditComponent';
    zIndex : number = 0;
    tabID : string = '';
    posx : number = 0;
    posy : number = 0;
    data?: Object = {};
}
