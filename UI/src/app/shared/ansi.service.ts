import { Injectable } from '@angular/core';
import { Ansi2Html } from './ansi2html';
import { AnsiSgrAttribute } from './ansi-sgr-attribute';
import { AnsiColour } from './ansi-colour';
import { Ansi256Colors } from './ansi256colors';

@Injectable({
  providedIn: 'root'
})
export class AnsiService {

  public ESC_CLRSCR : string = '\e[H\e[J'; 
  public ESC_m_FG256 : string = '38;5;';
  public ESC_m_BG256 : string = '48;5;';
  public ESC_m_FG_RGB : string = '39;2;';
  public ESC_m_BG_RGB : string = '49;2;';
  

  constructor() { }

  private toHex2(val:number) {
    var result = val.toString(16);
    if (result.length<2) {
      return '0'+result;
    } else {
      return result;
    }
  }

  public getDefault() : Ansi2Html {
    return {
      esc:'',
      result:'',
      sgr:[],
      fg_rgb : 'white',
      bg_rgb : 'black',
      bold : false,
      italic: false,
      underline: false,
      blink:false,
      reverse:false,
      concealed:false,
    }
  }

  public checkEscape(seq:string,lastchar :string,ansi2html:Ansi2Html) : Ansi2Html {
    var mseq :string;
    var colstr : string;
    var split :string[];
    var ival : number;
    var colval : number;
    var ob;
    const other = this;
    if (seq.length >= 3 && seq.substr(1,1)=='[' && lastchar == 'm') {
      mseq = seq.substr(2);
      mseq = mseq.substr(0,mseq.length-1);
      console.log('ESC1:'+mseq);
      if (mseq.startsWith(this.ESC_m_FG_RGB)) {
        colstr = mseq.substr(this.ESC_m_FG_RGB.length);
        split = colstr.split(';');
        if (split.length == 3) {
          ansi2html.fg_rgb = "#"
            + this.toHex2(Number.parseInt(split[0]))
            + this.toHex2(Number.parseInt(split[1]))
            + this.toHex2(Number.parseInt(split[2]));
        } else {
          console.log("FG_RGB:"+mseq);
          ansi2html.debug = 'FG_RGB:'+mseq;
        }
      } else if (mseq.startsWith(this.ESC_m_BG_RGB)) {
        colstr = mseq.substr(this.ESC_m_BG_RGB.length);
        split = colstr.split(';');
        if (split.length == 3) {
          ansi2html.bg_rgb = "#"
            + this.toHex2(Number.parseInt(split[0]))
            + this.toHex2(Number.parseInt(split[1]))
            + this.toHex2(Number.parseInt(split[2]));
        } else {
          console.log("BG_RGB:"+mseq);
          ansi2html.debug = 'BG_RGB:'+mseq;
        }
      } else if (mseq.startsWith(this.ESC_m_FG256)) {
        colstr = mseq.substr(this.ESC_m_FG256.length);
        colval = Number.parseInt(colstr);
        ansi2html.fg = colval;
        ansi2html.fg_bright = true;
        ansi2html.fg_text = 'f'+this.toHex2(colval);
        ansi2html.fg_rgb = Ansi256Colors.normal[this.toHex2(colval)];
      } else if (mseq.startsWith(this.ESC_m_BG256)) {
        colstr = mseq.substr(this.ESC_m_BG256.length);
        colval = Number.parseInt(colstr);
        ansi2html.bg = colval;
        ansi2html.bg_bright = true;
        ansi2html.bg_text =  'b'+this.toHex2(colval);
        ansi2html.bg_rgb = Ansi256Colors.normal[this.toHex2(colval)];
      } else {
        split = mseq.split(';');
        split.forEach(function(val :string,idx:number,arr:string[]){
          if (val=='') val = '0';
          ival = Number.parseInt(val);
          ob = AnsiSgrAttribute.code2info(ival);
          if (typeof ob !== 'undefined') {
            ansi2html.sgr.push(ob.t);
          } else {
            if (val.length == 2) {
              colstr = val.substr(1,1);
              colval = Number.parseInt(colstr);
              ob = AnsiColour.getCode2ColourInfo(colval);
              if (typeof ob !== 'undefined') {
                switch (val.substr(0,1)) {
                  case '3': // foreground
                    if (colval == 8) {
                      break;
                    } else if (colval == 9) {
                      ansi2html.fg = -1;
                      break;
                    }
                    ansi2html.fg = ob.c;
                    ansi2html.fg_bright = false;
                    ansi2html.fg_text = ob.t;
                    ansi2html.fg_rgb = Ansi256Colors.faint[other.toHex2(ob.c)];
                    break;
                  case '4': // background
                    if (colval == 8) {
                      break;
                    } else if (colval == 9) {
                      ansi2html.bg = -1;
                      break;
                    }
                    ansi2html.bg = ob.c;
                    ansi2html.bg_bright = false;
                    ansi2html.bg_text = ob.t;
                    ansi2html.bg_rgb = Ansi256Colors.faint[other.toHex2(ob.c)];
                    break;
                  case '9': // bright foreground
                    if (colval > 7) break;
                    ansi2html.fg = ob.c;
                    ansi2html.fg_bright = true;
                    ansi2html.fg_text = ob.t;
                    ansi2html.fg_rgb = Ansi256Colors.normal[other.toHex2(ob.c)];
                  break;
                } // switch
              } // color ob undef
            } else if (val.length == 3 && val.substr(0,2)=='10') {
              colstr = val.substr(2,1);
              colval = Number.parseInt(colstr);
              ob = AnsiColour.getCode2ColourInfo(colval);
              if (colval <8 && typeof ob !== 'undefined') { // bright background
                ansi2html.bg = ob.c;
                ansi2html.bg_bright = true;
                ansi2html.bg_text = ob.t;
                ansi2html.bg_rgb = Ansi256Colors.normal[other.toHex2(ob.c)];
              } // colval undef
            }// len 3 and 10...
          }// tpyoeof ob undefined else (sgr attribute)
        });// foreach
      }
    } 
    // TODO check and process escape sequences.
    // console.log("ESC: "+seq)
    // ansi2html.result = '<ESC>'+seq.substr(1);
    console.log('ESC9:'+JSON.stringify(ansi2html));
    return ansi2html;
  }
  public ansiTransform(inp:string,a2current:Ansi2Html) : Ansi2Html[] {
    var newstr : string = '';
    var ch, st, re=[], tmp, esc;
    var result : Ansi2Html[] = [];
    for (var i = 0; i < inp.length; i++ ) {
      ch = inp.charCodeAt(i);  // get char 
      st = [];                 // set up "stack"
      tmp = String.fromCharCode(ch);
      do {
        st.push( ch & 0xFF );  // push byte to stack
        ch = ch >> 8;          // shift value down by 1 byte
      }  
      while ( ch );
      re = re.concat( st.reverse() );
      // console.log(tmp +': '+ st.reverse());
      if (st.length == 1) {
        if (typeof esc !== 'undefined') {
          esc += tmp;
          if ( (st[0]>= 65 && st[0]<=90)   // uppercase ANSI
             ||(st[0] >=97 && st[0]<=122) ){// lowercase ANSI
              console.log('1='+JSON.stringify(a2current));
              a2current = this.checkEscape(esc,tmp,a2current);
              while (a2current.sgr.length>0) {
                const sgrcmd : string = a2current.sgr.shift();
                switch (sgrcmd) {
                  case 'RESET': 
                    a2current.fg_rgb = 'white';
                    a2current.bg_rgb = 'black';
                    break;
                }
              }
              a2current.esc = esc;
              console.log('ESC:'+esc);
              esc = undefined;
          } // if ANSI-Letter.
        } else { // if typeof esc
          switch (st[0]) {
            case 27: 
              esc = tmp;
              a2current.text = newstr;
              console.log('ESC-END:'+newstr);
              newstr = '';
              if (a2current.text != "") {
                result.push(a2current);
              }
              // a2current.text = '';
              break;
            case 10: newstr += "\n"; break;
            case 13: break; // \r
            default: newstr = newstr.concat(tmp);break;
          } // switch
        } // if typeof esc
      } else { // st.len != 1
        newstr = newstr.concat(tmp);
      } // if st.len else
    } // for
    // console.log(re);
    a2current.text = newstr;
    console.log('2='+JSON.stringify(a2current));
    result.push(a2current);
    return result;
  }
}
