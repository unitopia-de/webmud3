export class AnsiData {
    fontheight : number = 16;
    fontwidth : number = 8;
    // data.canvas = $('<canvas width="' + (data.fontwidth * 80) + 'px" height="' + (data.fontheight * 25) + 'px">');
    ansi :string = '';
    ansiPos : number = 0;
    fgcolor : string = 'white';
    bgcolor : string = 'black';
    bold : boolean = false;
    faint : boolean = false;
    blink : boolean = false;
    italic : boolean = false;
    underline : boolean = false;
    reverse : boolean = false;
    concealed : boolean = false;
    crossedout : boolean = false;
    text : string = '';
}