export class FileInfo {
    lasturl : string = '';
    filepath : string = '';
    filename : string = '';
    filetype : string = '';
    content : string = '';
    saveActive : boolean = false;
    alreadyLoaded : boolean = false;
    windowsId : string = undefined;
    relateWindow? = function(wid){};    
    load? = function(cb) {};
    save? = function(txt,cb,) {};
}