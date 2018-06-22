export class Ansi2Html{
    esc: string;
    result: string;
    sgr:string[]; // sgr-Commands
    debug?: string;
    fg?:        number;
    fg_bright?: boolean;
    fg_text?:   string;
    fg_rgb:    string;
    bg?:        number;
    bg_bright?: boolean;
    bg_text?:   string;
    bg_rgb:    string;
    text?:string;
    bold: boolean;
    italic:boolean;
    underline:boolean;
    blink:boolean;
    reverse:boolean;
    concealed:boolean;
}