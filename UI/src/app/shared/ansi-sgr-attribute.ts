export class AnsiSgrAttribute { 
    // sgr = select graphic rendition
    // https://en.wikipedia.org/wiki/ANSI_escape_code#SGR_(Select_Graphic_Rendition)_parameters
    static attributelist = [
        'RESET','INTENSITY_BOLD','INTENSITY_FAINT',
        'ITALIC','UNDERLINE','BLINK_SLOW','BLINK_FAST',
        'NEGATIVE_ON','CONCEAL_ON','STRIKETHROUGH_ON',
        'ATTR_10','ATTR_11','ATTR_12','ATTR_13','ATTR_14',
        'ATTR_15','ATTR_16','ATTR_17','ATTR_18','ATTR_19',
        'ATTR_20','UNDERLINE_DOUBLE','INTENSITY_BOLD_OFF',
        'ITALIC_OFF','UNDERLINE_OFF','BLINK_OFF','ATTR_26',
        'NGEATIVE_OFF','CONCEAL_OFF','STRIKETHROUGH_OFF'
    ];
    static attributeinfo = Object.freeze({
        'RESET'             : {a:0,t:'RESET'},
        'INTENSITY_BOLD'    : {a:1,t:'INTENSITY_BOLD'},
        'INTENSITY_FAINT'   : {a:2,t:'INTENSITY_FAINT'},
        'ITALIC'            : {a:3,t:'ITALIC'},
        'UNDERLINE'         : {a:4,t:'UNDERLINE'},
        'BLINK_SLOW'        : {a:5,t:'BLINK_SLOW'},
        'BLINK_FAST'        : {a:6,t:'BLINK_FAST'},
        'NEGATIVE_ON'       : {a:7,t:'NEGATIVE_ON'},
        'CONCEAL_ON'        : {a:8,t:'CONCEAL_ON'},
        'STRIKETHROUGH_ON'  : {a:9,t:'STRIKETHROUGH_ON'},
        'UNDERLINE_DOUBLE'  : {a:21,t:'UNDERLINE_DOUBLE'},
        'INTENSITY_BOLD_OFF': {a:22,t:'INTENSITY_BOLD_OFF'},
        'ITALIC_OFF'        : {a:23,t:'ITALIC_OFF'},
        'UNDERLINE_OFF'     : {a:24,t:'UNDERLINE_OFF'},
        'BLINK_OFF'         : {a:25,t:'BLINK_OFF'},
        'NGEATIVE_OFF'      : {a:27,t:'NGEATIVE_OFF'},
        'CONCEAL_OFF'       : {a:28,t:'CONCEAL_OFF'},
        'STRIKETHROUGH_OFF' : {a:29,t:'STRIKETHROUGH_OFF'}
    });

    public static attribute2info(att:string) : Object {
        if (typeof this.attributeinfo[att] !=='undefined') {
            return this.attributeinfo[att];
        }
        return undefined;
    }
    public static code2info(val:number) : Object {
        if (val < 0 || val >= this.attributelist.length) {
            return undefined;
        }
        const astr = this.attributelist[val];
        return this.attribute2info(astr);
    }

    public value : number;
    public name : string;

    constructor(val:number,nam:string) {
        this.value = val;
        this.name = nam;
    }
}