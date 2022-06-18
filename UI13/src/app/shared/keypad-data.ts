
export class OneKeypadData {
    public prefix:string='';
    public keys : any = {};
    public addKey(key:string,value:string) {
        this.keys[key] = value;
    }
    public getKey(key:string):string {
        return this.keys[key]||'';
    }
}

export class KeypadData {
    public levels : any = {};
    public addKey(prefix:string,key:string,value:string) {
        if (typeof this.levels[prefix] === 'undefined') {
            var level = new OneKeypadData();
            level.addKey(key,value);
            this.levels[prefix] = level;
        } else {
            this.levels[prefix].addKey(key,value);
        }
    }
    public getLevel(prefix:string):OneKeypadData {
        return this.levels[prefix]||new OneKeypadData();
    }
    public getCompoundKey(modifiers:string):string {
        const msplit = modifiers.split("|");
        const lvl = this.getLevel(msplit[0]);
        return lvl.getKey(msplit[1]);
    }
}