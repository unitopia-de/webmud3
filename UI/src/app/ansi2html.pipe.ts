import { Pipe, PipeTransform } from '@angular/core';
import { AnsiService } from './shared/ansi.service';

@Pipe({
  name: 'ansi2html'
})
export class Ansi2htmlPipe implements PipeTransform {

  transform(value: string, args?: any): any {
    var newstr : string = '';
    var ch, st, re=[], tmp, esc;
    for (var i = 0; i < value.length; i++ ) {
      ch = value.charCodeAt(i);  // get char 
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
          esc = esc.concat(tmp);
          if ( (st[0]>= 65 && st[0]<=95)   // uppercase ANSI
             ||(st[0] >=97 && st[0]<=122) ){// lowercase ANSI
              var ansi2html = this.ansiService.checkEscape(esc,tmp,
                this.ansiService.getDefault());
              newstr = newstr.concat(ansi2html.result);
              esc = undefined;
          } // if ANSI-Letter.
        } else { // if typeof esc
          switch (st[0]) {
            case 27: esc = tmp; break;
            default: newstr = newstr.concat(tmp);break;
          } // switch
        } // if typeof esc
      } else { // st.len != 1
        newstr = newstr.concat(tmp);
      } // if st.len else
    } // for
    // console.log(re);
    return newstr;
  }
  constructor(private ansiService: AnsiService) { }
}
