import { Injectable } from '@angular/core';
import { Ansi256Colors } from './ansi256colors';
import { AnsiData } from './ansi-data';

@Injectable({
  providedIn: 'root',
})
export class AnsiService {
  public ESC_CLRSCR = 'e[He[J';
  public ESC_m_FG256 = '38;5;';
  public ESC_m_BG256 = '48;5;';
  public ESC_m_FG_RGB = '39;2;';
  public ESC_m_BG_RGB = '49;2;';
  public ESC_VALID = /^[0-9;A-Za-z]$/;
  public ESC_ENDCHAR = /^[A-Za-z]$/;

  private toHex2(val: number) {
    const result = val.toString(16);
    if (result.length < 2) {
      return '0' + result;
    } else {
      return result;
    }
  }

  public toBinaryBase64(u: string) {
    const codeUnits = new Uint16Array(u.length);
    for (let i = 0; i < codeUnits.length; i++) {
      codeUnits[i] = u.charCodeAt(i);
    }
    const charCodes = new Uint8Array(codeUnits.buffer);
    let result = '';
    for (let i = 0; i < charCodes.byteLength; i++) {
      result += String.fromCharCode(charCodes[i]);
    }
    result = btoa(result);
    console.log('toBinaryBase64', result);
    return result;
  }

  public fromBinaryBase64(encoded: string) {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const charCodes = new Uint16Array(bytes.buffer);
    let result = '';
    for (let i = 0; i < charCodes.length; i++) {
      result += String.fromCharCode(charCodes[i]);
    }
    return result;
  }

  public invColor(s: string) {
    let iconv = (parseInt(s.substr(1), 16) << 8) / 256;
    iconv = (iconv ^ 0x00ffffff) & 0x00ffffff; // Invert color
    return (
      '#' +
      '000000'.slice(0, 6 - iconv.toString(16).length) +
      iconv.toString(16)
    );
  }

  public blackToWhite(s: string) {
    const iconv = (parseInt(s.substr(1), 16) << 8) / 256;
    const r = (iconv & 0xff0000) >> 16;
    const g = (iconv & 0x00ff00) >> 8;
    const b = iconv & 0x0000ff;
    return r == g && g == b ? this.invColor(s) : s;
  }

  public extractColors(
    a2h: AnsiData,
    colors: string[],
    bow: boolean,
    invert: boolean,
    colorOff: boolean,
  ): string[] {
    const result = ['#000000', '#ffffff'];
    let lfg: string;
    let lbg: string;
    if (colorOff) {
      if (bow || invert) {
        result[0] = '#000000';
        result[1] = '#ffffff';
      } else {
        result[0] = '#ffffff';
        result[1] = '#000000';
      }
      return result;
    } else if (typeof colors !== 'undefined' && colors.length == 2) {
      lfg = colors[0];
      lbg = colors[1];
    } else if (typeof a2h === 'undefined') {
      if (bow || invert) {
        result[0] = '#000000';
        result[1] = '#ffffff';
      } else {
        result[0] = '#ffffff';
        result[1] = '#000000';
      }
      return result;
    } else {
      if (a2h.reverse) {
        lfg = a2h.bgcolor;
        lbg = a2h.fgcolor;
      } else {
        lfg = a2h.fgcolor;
        lbg = a2h.bgcolor;
      }
    }
    if (invert) {
      lfg = this.invColor(lfg);
      lbg = this.invColor(lbg);
    }
    if (!bow) {
      result[0] = lfg;
      result[1] = lbg;
    } else {
      result[0] = this.blackToWhite(lfg);
      result[1] = this.blackToWhite(lbg);
    }
    return result;
  }

  public ansiCode(data: AnsiData): AnsiData {
    data = Object.assign({}, data);
    if (data.ansiPos >= data.ansi.length - 1) {
      data.lastEscape = String.fromCharCode(27);
      return data;
    }
    let char = data.ansi[data.ansiPos];
    let escape = '';
    let stop = false;
    let i = 0;
    let codes;
    if (char == '[') {
      do {
        data.ansiPos += 1;
        char = data.ansi[data.ansiPos];
        escape += char;
        stop = this.ESC_ENDCHAR.test(char);
      } while (
        data.ansiPos < data.ansi.length - 1 &&
        this.ESC_VALID.test(char) &&
        !stop
      );
      if (!stop) {
        console.debug('AnsiService:ansiCode:', 'ESC[' + escape);
        data.lastEscape = String.fromCharCode(27) + '[' + escape;
        data.ansiPos += 1;
        return data;
      }
      data.ansiPos += 1;
    } else {
      switch (char) {
        case '7': // Save current cursor position
        case '8': // Restore cursor position
        case 'D': // Scroll Down one Line
          data.ansiPos += 1;
          return data;
      }
      escape += char;
      do {
        data.ansiPos += 1;
        char = data.ansi[data.ansiPos];
        escape += char;
        stop = this.ESC_ENDCHAR.test(char);
      } while (this.ESC_VALID.test(char) && !stop);
      console.error('AnsiService:ansiCode missing-ESC:', 'ESC[' + escape);
      data.ansiPos += 1;
      return data; // hide unknown escapes...
    }
    switch (escape[escape.length - 1]) {
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
        console.error('AnsiService:ansiCode unsupported-ESC:', 'ESC[' + escape);
        break; // no action?
      case 'r': //  scroll screen
        break; // no action!
      case 'm': // Change attrinutes / colors
        codes = escape.substring(0, escape.length - 1).split(';');
        for (i = 0; i < codes.length; i++) {
          const code = codes[i];
          let setcolor256fg = '';
          let setcolor256bg = '';
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
              data.fgcolor = '#ffffff';
              data.bgcolor = '#000000';
              break;
            case '1':
              data.bold = true;
              break;
            case '2':
              data.faint = true;
              break;
            case '3':
              data.italic = true;
              break;
            case '4':
              data.underline = true;
              break;
            case '5':
              data.blink = true;
              break; // slow
            case '6':
              data.blink = true;
              break; // rapid
            case '7':
              data.reverse = true;
              break;
            case '8':
              data.concealed = true;
              break;
            case '9':
              data.crossedout = true;
              break;
            case '21':
              data.bold = false;
              break;
            case '22':
              data.bold = data.faint = false;
              break;
            case '23':
              data.italic = false;
              break;
            case '24':
              data.underline = false;
              break;
            case '25':
              data.blink = false;
              break;
            case '27':
              data.reverse = false;
              break;
            case '28':
              data.concealed = false;
              break; // Reveal
            case '29':
              data.crossedout = false;
              break;
            case '30':
              setcolor256fg = '00';
              break;
            case '31':
              setcolor256fg = '01';
              break;
            case '32':
              setcolor256fg = '02';
              break;
            case '33':
              setcolor256fg = '03';
              break;
            case '34':
              setcolor256fg = '04';
              break;
            case '35':
              setcolor256fg = '05';
              break;
            case '36':
              setcolor256fg = '06';
              break;
            case '37':
              setcolor256fg = '07';
              break;
            case '38':
              if (codes.length > i + 2 && codes[i + 1] == '5') {
                // 256 colors
                setcolor256fg = this.toHex2(Number.parseInt(codes[i + 2]));
                i += 2;
              } else if (codes.length > i + 4 && codes[i + 1] == '2') {
                // 256 colors
                data.fgcolor =
                  '#' +
                  this.toHex2(Number.parseInt(codes[i + 2])) +
                  this.toHex2(Number.parseInt(codes[i + 3])) +
                  this.toHex2(Number.parseInt(codes[i + 4]));
                i += 4;
                break;
              } else {
                console.error(
                  'AnsiService:ansiCode unknown fgcolor-ESC:',
                  'ESC[' + escape,
                );
                break;
              }
              break;
            case '39':
              data.fgcolor = 'white';
              break;
            case '40':
              setcolor256bg = '00';
              break;
            case '41':
              setcolor256bg = '01';
              break;
            case '42':
              setcolor256bg = '02';
              break;
            case '43':
              setcolor256bg = '03';
              break;
            case '44':
              setcolor256bg = '04';
              break;
            case '45':
              setcolor256bg = '05';
              break;
            case '46':
              setcolor256bg = '06';
              break;
            case '47':
              setcolor256bg = '07';
              break;
            case '48':
              if (codes.length > i + 2 && codes[i + 1] == '5') {
                // 256 colors
                setcolor256bg = this.toHex2(Number.parseInt(codes[i + 2]));
                i += 2;
              } else if (codes.length > i + 4 && codes[i + 1] == '2') {
                // 256 colors
                data.bgcolor =
                  '#' +
                  this.toHex2(Number.parseInt(codes[i + 2])) +
                  this.toHex2(Number.parseInt(codes[i + 3])) +
                  this.toHex2(Number.parseInt(codes[i + 4]));
                i += 4;
                break;
              } else {
                console.error(
                  'AnsiService:ansiCode unknown bgcolor-ESC:',
                  'ESC[' + escape,
                );
                break;
              }
              break;
            case '49':
              data.bgcolor = 'black';
              break;
            case '90':
              setcolor256fg = '00';
              break; // bright colors mapped to normal colors.
            case '91':
              setcolor256fg = '01';
              break;
            case '92':
              setcolor256fg = '02';
              break;
            case '93':
              setcolor256fg = '03';
              break;
            case '94':
              setcolor256fg = '04';
              break;
            case '95':
              setcolor256fg = '05';
              break;
            case '96':
              setcolor256fg = '06';
              break;
            case '97':
              setcolor256fg = '07';
              break;
            case '100':
              setcolor256bg = '00';
              break;
            case '101':
              setcolor256bg = '01';
              break;
            case '102':
              setcolor256bg = '02';
              break;
            case '103':
              setcolor256bg = '03';
              break;
            case '104':
              setcolor256bg = '04';
              break;
            case '105':
              setcolor256bg = '05';
              break;
            case '106':
              setcolor256bg = '06';
              break;
            case '107':
              setcolor256bg = '07';
              break;
            default:
              console.error(
                'AnsiService:ansiCode unknown attribute/color-ESC:',
                'ESC[' + escape,
              );
              break;
          }
          if (setcolor256fg != '') {
            data.fgcolor = data.faint
              ? Ansi256Colors.faint[setcolor256fg]
              : Ansi256Colors.normal[setcolor256fg];
          }
          if (setcolor256bg != '') {
            data.bgcolor = data.faint
              ? Ansi256Colors.faint[setcolor256bg]
              : Ansi256Colors.normal[setcolor256bg];
          }
          if (data.fgcolor == data.bgcolor) {
            data.fgcolor = this.invColor(data.fgcolor);
          }
          if (data.optionInvert) {
            data.fgcolor = this.invColor(data.fgcolor);
            data.bgcolor = this.invColor(data.bgcolor);
          }
        } // for m
        break;
    }
    return data;
  }

  public processAnsi(data: AnsiData): AnsiData[] {
    const result: AnsiData[] = [];
    data = Object.assign({}, data);
    data.text = '';
    if (typeof data.mudEcho !== 'undefined' && data.ansi == '') {
      data = Object.assign({}, data);
      result.push(data);
      data = Object.assign({}, data);
      data.mudEcho = undefined;
      result.push(data);
      return result;
    }
    if (typeof data.lastEscape !== 'undefined') {
      console.info(
        'AnsiService:processAnsi esc-pad',
        data.lastEscape,
        data.ansi.substr(0, 30),
      );
      data.ansi = data.lastEscape + data.ansi;
      data.lastEscape = undefined;
    }
    console.debug('AnsiService:processAnsi', data);
    while (data.ansiPos < data.ansi.length) {
      // <=???
      const code: number = data.ansi.charCodeAt(data.ansiPos); //  & 0xff;
      data.ansiPos += 1;
      let display = true;
      if (code < 33 || code > 126) {
        switch (code) {
          case 0:
            display = false;
            break;
          case 10:
            break;
          case 13:
            break;
          case 27:
            display = false;
            if (data.text != '') {
              data = Object.assign({}, data);
              result.push(data);
              data = Object.assign({}, data);
              data.text = '';
            }
            data = this.ansiCode(data);
            break;
          default:
            display = true;
            break;
        }
      }
      if (display) {
        data.text += String.fromCharCode(code);
      }
    }
    data.ansi = '';
    data.ansiPos = 0;
    data = Object.assign({}, data);
    result.push(data);
    return result;
  }
}
