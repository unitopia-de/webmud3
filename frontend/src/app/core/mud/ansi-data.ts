export class AnsiData {
  fontheight = 16;
  fontwidth = 8;
  // data.canvas = $('<canvas width="' + (data.fontwidth * 80) + 'px" height="' + (data.fontheight * 25) + 'px">');
  ansi = '';
  mudEcho = '';
  lastEscape?: string = undefined;
  ansiPos = 0;
  fgcolor = '#ffffff';
  bgcolor = '#000000';
  bold = false;
  faint = false;
  blink = false;
  italic = false;
  underline = false;
  reverse = false;
  concealed = false;
  crossedout = false;
  optionInvert = false;
  timeString = '';
  text = '';
}
