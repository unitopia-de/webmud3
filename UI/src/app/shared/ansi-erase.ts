export class AnsiErase {
    public static codelist = ['FORWARD','BACKWARD','ALL'];
    public static codeinfo = Object.freeze({
        'FORWARD':  {e:0,t:'FORWARD'},
        'BACKWARD': {e:1,t:'BACKWARD'},
        'ALL':      {e:2,t:'ALL'},
    });

    public static erase2info(estr : string) : Object {
        if (typeof this.codeinfo[estr] !=='undefined') {
            return this.codeinfo[estr]
        }
        return undefined;
    }

    public static code2info(code : number) : Object {
        if (code < 0 || code > 2) {
            return undefined;
        }
        return this.erase2info(this.codelist[code]);
    }

    public value : number;
    public name : string;

    constructor(val:number,nam:string) {
        this.value = val;
        this.name = nam;
    }
}