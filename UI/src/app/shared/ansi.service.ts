import { Injectable } from '@angular/core';
import { Ansi256Colors } from './ansi256colors';
import { AnsiData } from './ansi-data';

@Injectable({
  providedIn: 'root'
})
export class AnsiService {

  public ESC_CLRSCR : string = '\e[H\e[J'; 
  public ESC_m_FG256 : string = '38;5;';
  public ESC_m_BG256 : string = '48;5;';
  public ESC_m_FG_RGB : string = '39;2;';
  public ESC_m_BG_RGB : string = '49;2;';
  public ESC_VALID = /^[0-9;A-Za-z]$/;
  public ESC_ENDCHAR = /^[A-Za-z]$/;

  constructor() { }

  private toHex2(val:number) {
    var result = val.toString(16);
    if (result.length<2) {
      return '0'+result;
    } else {
      return result;
    }
  }

  public ansiCode(data: AnsiData): AnsiData {
    if (data.ansiPos >= data.ansi.length-1) {
      return data;
    }
    data = Object.assign({},data);
    var char = data.ansi[data.ansiPos];
    var escape = '';
    var stop = false;
    if (char == '[') {
      do {
        data.ansiPos += 1;
        char = data.ansi[data.ansiPos];
        escape += char;
        stop = this.ESC_ENDCHAR.test(char);
      } while (this.ESC_VALID.test(char) && !stop);
      //console.log('ESC['+escape);
      data.ansiPos += 1;
    } else {
      escape += char;
      do {
        data.ansiPos += 1;
        char = data.ansi[data.ansiPos];
        escape += char;
        stop = this.ESC_ENDCHAR.test(char);
      } while (this.ESC_VALID.test(char) && !stop);
      console.log('[ missing:<ESC>'+escape); // TODO provide error to server.
      data.ansiPos += 1;
      return data; // hide unknown escapes...
    }
    switch(escape[escape.length - 1]) {
      case 'J': // Clear screen, handled somewhere else?
      case 'H': // move to, handled somewhere else?
        break;
      case 'A': // Move up
      case 'B': // Move down
      case 'C': // Move Forward
      case 'D': // Move back
      case 'K': // Clear
      case 's': // Save position
      case 'u': // Restore position
      default:
        console.log('unsupported:<ESC>['+escape);
        break; // no action?
      case 'm': // Change attrinutes / colors
        var codes = escape.substring(0, escape.length - 1).split(';');
        for (var i=0; i < codes.length; i++) {
            var code = codes[i];
            var setcolor256fg = '';
            var setcolor256bg = '';
            switch (code) {
                case '0':
                    data.bold = false;
                    data.faint = false;
                    data.italic = false;
                    data.underline = false;
                    data.blink = false;
                    data.reverse = false;
                    data.concealed = false;
                    data.crossedout = false;
                    data.fgcolor = 'white';
                    data.bgcolor = 'black';
                    break;
                case '1': data.bold = true; break;
                case '2': data.faint = true; break;
                case '3': data.italic = true; break;
                case '4': data.underline = true; break;
                case '5': data.blink = true; break; // slow
                case '6': data.blink = true; break; // rapid
                case '7': data.reverse = true;break; 
                case '8': data.concealed = true; break;
                case '9': data.crossedout = true;break;
                case '21': data.bold = false; break;
                case '22': data.bold = data.faint = false;break;
                case '23': data.italic = false;break;
                case '24': data.underline = false; break;
                case '25': data.blink = false; break;
                case '27': data.reverse = false; break;
                case '28': data.concealed = false; break;// Reveal
                case '29': data.crossedout = false;break;
                case '30': setcolor256fg = '00'; break;
                case '31': setcolor256fg = '01'; break;
                case '32': setcolor256fg = '02'; break;
                case '33': setcolor256fg = '03'; break;
                case '34': setcolor256fg = '04'; break;
                case '35': setcolor256fg = '05'; break;
                case '36': setcolor256fg = '06'; break;
                case '37': setcolor256fg = '07'; break;
                case '38': 
                  if (codes.length > i+2 && codes[i+1] == '5') { // 256 colors
                    setcolor256fg = this.toHex2(Number.parseInt(codes[i+2]));
                    i += 2;
                  } else if (codes.length > i+4 && codes[i+1] == '2') { // 256 colors
                    data.fgcolor = '#'+this.toHex2(Number.parseInt(codes[i+2]))
                      + this.toHex2(Number.parseInt(codes[i+3]))
                      + this.toHex2(Number.parseInt(codes[i+4]));
                    i += 4;
                    break;
                  } else {
                    console.log('unknown fg-color <ESC>'+escape);
                    break;
                  }
                case '39': data.fgcolor = 'white';break;
                case '40': setcolor256bg = '00'; break;
                case '41': setcolor256bg = '01'; break;
                case '42': setcolor256bg = '02'; break;
                case '43': setcolor256bg = '03'; break;
                case '44': setcolor256bg = '04'; break;
                case '45': setcolor256bg = '05'; break;
                case '46': setcolor256bg = '06'; break;
                case '47': setcolor256bg = '07'; break;
                case '48': 
                  if (codes.length > i+2 && codes[i+1] == '5') { // 256 colors
                    setcolor256bg = this.toHex2(Number.parseInt(codes[i+2]));
                    i += 2;
                  } else if (codes.length > i+4 && codes[i+1] == '2') { // 256 colors
                    data.bgcolor = '#'+this.toHex2(Number.parseInt(codes[i+2]))
                      + this.toHex2(Number.parseInt(codes[i+3]))
                      + this.toHex2(Number.parseInt(codes[i+4]));
                    i += 4;
                    break;
                  } else {
                    console.log('unknown bg-color <ESC>'+escape);
                    break;
                  }
                case '49': data.bgcolor = 'black';break;
                case '90': setcolor256fg = '00'; break; // bright colors mapped to normal colors.
                case '91': setcolor256fg = '01'; break;
                case '92': setcolor256fg = '02'; break;
                case '93': setcolor256fg = '03'; break;
                case '94': setcolor256fg = '04'; break;
                case '95': setcolor256fg = '05'; break;
                case '96': setcolor256fg = '06'; break;
                case '97': setcolor256fg = '07'; break;
                case '100': setcolor256bg = '00'; break;
                case '101': setcolor256bg = '01'; break;
                case '102': setcolor256bg = '02'; break;
                case '103': setcolor256bg = '03'; break;
                case '104': setcolor256bg = '04'; break;
                case '105': setcolor256bg = '05'; break;
                case '106': setcolor256bg = '06'; break;
                case '107': setcolor256bg = '07'; break;
                default:
                console.log('unknown attribute/color <ESC>'+escape);
                break;
            }
            if (setcolor256fg!='') {
              data.fgcolor = data.faint 
                ? Ansi256Colors.faint[setcolor256fg] 
                : Ansi256Colors.normal[setcolor256fg];
            }
            if (setcolor256bg!='') {
              data.bgcolor = data.faint 
                ? Ansi256Colors.faint[setcolor256bg] 
                : Ansi256Colors.normal[setcolor256bg];
            }
          } // for m
          break;
        }
    return data;
  }

  public processAnsi(data : AnsiData) : AnsiData[] {
    var result : AnsiData[] = [];
    data = Object.assign({},data);
    data.text ='';
    // console.log('processAnsi-1 '+JSON.stringify(data));
    while (data.ansiPos < data.ansi.length) { // <=???
      var code :number = data.ansi.charCodeAt(data.ansiPos) & 0xff;
      data.ansiPos += 1;
      var display = true;
      if (code < 33 || code > 126) {
            switch (code) {
                case 0: display = false; break;
                //case 10: display = false; cursorStartOfLine.call(this); break;
                //case 13: display = false; cursorDown.call(this, 1); break;
                case 27: 
                  display = false;
                  if (data.text != '') {
                    // console.log('processAnsi-2-'+result.length+': '+JSON.stringify(data));
                    data = Object.assign({},data);
                    result.push(data);
                    data = Object.assign({},data);
                    data.text = '';
                  }
                  data = this.ansiCode(data); 
                  break;
                default: display = true; break;
            }
        }
      if (display) {
        data.text += String.fromCharCode(code);
      }
    }
    data.ansi = '';
    data.ansiPos = 0;
    // console.log('processAnsi-3 '+JSON.stringify(data));
    data = Object.assign({},data);
    result.push(data);
    // console.log('processAnsi-9 '+JSON.stringify(result));
    return result;
  }

}
