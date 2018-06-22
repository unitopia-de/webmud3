export class AnsiColour {
    // https://en.wikipedia.org/wiki/ANSI_escape_code#Colors
    static colour2info = Object.freeze ({
        BLACK   : { c : 0, t:'BLACK'},
        RED     : { c : 1, t:'RED'},
        GREEN   : { c : 2, t:'GREEN'},
        YELLOW  : { c : 3, t:'YELLOW'},
        BLUE    : { c : 4, t:'BLUE'},
        MAGENTA : { c : 5, t:'MAGENTA'},
        CYAN    : { c : 6, t:'CYAN'},
        WHITE   : { c : 7, t:'WHITE'},
        UNDEFINED   : { c : 8, t:'UNDEFINED'},
        DEFAULT : { c : 9, t:'DEFAULT'},
    });
    static code2colour = [
        'BLACK','RED','GREEN','YELLOW','BLUE',
        'MAGENTA','CYAN','WHITE','UNDEFINED','DEFAULT'
    ];

    value : number;
    name  : string;

    constructor(val :number,nam:string) {
        this.value = val;
        this.name = nam;
    }

    public static getCode2ColourInfo(val:number) : Object {
        if (val < 0 || val >9) {
            return undefined;
        }
        const cstr = this.code2colour[val];
        return this.colour2info[cstr];
    }

    public static getColour2Info(colour : string) : Object {
        if (typeof this.colour2info[colour] !=='undefined') {
            return this.colour2info[colour];
        }
        return undefined;
    }

    public fg() : number {
        return this.value + 30;
    }

    public bg() : number {
        return this.value + 40;
    }

    public fgBright() : number {
        return this.value + 90;
    }

    public bgBright() :number {
        return this.value + 100;
    }
}