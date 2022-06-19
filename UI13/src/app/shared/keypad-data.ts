
export class OneKeypadData {
    public prefix:string='';
    public keys : any = {};
    public addKey(key:string,value:string) {
        this.keys[key] = value;
    }
    public getKey(key:string):string {
        return this.keys[key]||'';
    }
    constructor(p:string) {
        this.prefix = p;
    }
}

export class KeypadData {
    public levels : any = {};
    public addKey(prefix:string,key:string,value:string) {
        if (typeof this.levels[prefix] === 'undefined') {
            var level = new OneKeypadData(prefix);
            level.addKey(key,value);
            this.levels[prefix] = level;
        } else {
            this.levels[prefix].addKey(key,value);
        }
    }
    public getLevel(prefix:string):OneKeypadData {
        if (typeof this.levels[prefix]=='undefined') {
            var level = new OneKeypadData(prefix);
            this.levels[prefix] = level;
        }
        return this.levels[prefix];
    }
    public getCompoundKey(modifiers:string):string {
        const msplit = modifiers.split("|");
        const lvl = this.getLevel(msplit[0]);
        return lvl.getKey(msplit[1]);
    }
    public setLevel(numpad:OneKeypadData) {
         this.levels[numpad.prefix] = numpad;
    }
}