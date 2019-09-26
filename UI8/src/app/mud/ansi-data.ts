export class AnsiData {
    fontheight : number = 16;
    fontwidth : number = 8;
    // data.canvas = $('<canvas width="' + (data.fontwidth * 80) + 'px" height="' + (data.fontheight * 25) + 'px">');
    ansi :string = '';
    lastEscape:string =undefined;
    ansiPos : number = 0;
    fgcolor : string = '#ffffff';
    bgcolor : string = '#000000';
    bold : boolean = false;
    faint : boolean = false;
    blink : boolean = false;
    italic : boolean = false;
    underline : boolean = false;
    reverse : boolean = false;
    concealed : boolean = false;
    crossedout : boolean = false;
    optionInvert : boolean = false;
    timeString: string = '';
    text : string = '';
}