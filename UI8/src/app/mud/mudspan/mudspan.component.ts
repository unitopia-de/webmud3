import { Component, OnInit, Input } from '@angular/core';
import { AnsiData } from '../ansi-data';
import { AnsiService } from '../ansi.service';

@Component({
  selector: 'app-mudspan',
  template:'<span display="inline" [ngClass]="myclasses" [style.color]="fg" [style.background]="bg">{{txt}}</span>',
  // templateUrl: './mudspan.component.html',
  styleUrls: ['./mudspan.component.css']
})
export class MudspanComponent implements OnInit {

  constructor(private ansiService:AnsiService) { }

  private a2h :AnsiData;
  public myclasses : string;
  public fg:string;
  public bg:string;
  public txt:string;
  public bow:boolean=false;
  public invert:boolean = false;
  public colorOff : boolean = false;
  public echoFlag : boolean = true;
  public echoCol : string = 'a8ff00';
  public tt:string='';

  private calcFgBg() {
    var lfg,lbg;
    if (typeof this.a2h === 'undefined' || this.colorOff) {
      if (this.bow || this.invert) {
        this.fg = '#000000';
        this.bg = '#ffffff';
      } else {
        this.fg = '#ffffff';
        this.bg = '#000000';
      }
      return;
    }
    if (this.a2h.reverse) {
      lfg = this.a2h.bgcolor;
      lbg = this.a2h.fgcolor;
    } else {
      lfg = this.a2h.fgcolor;
      lbg = this.a2h.bgcolor;
    }
    if (this.invert) {
      lfg = this.ansiService.invColor(lfg);
      lbg = this.ansiService.invColor(lbg);
    }
    if (typeof this.a2h.text !=='undefined' && this.a2h.text !='') {
      ; // no change
    } else if (typeof this.a2h.mudEcho !== 'undefined') {
      if (this.echoFlag) {
        this.txt = this.a2h.mudEcho;
        lfg = this.echoCol;
      } else {
        this.txt = '';
      }
    }
    if (!this.bow) {
      this.fg = lfg;
      this.bg = lbg;
    } else {
      this.fg = this.ansiService.blackToWhite(lfg);
      this.bg = this.ansiService.blackToWhite(lbg);
    }
    
    if (this.a2h.concealed) {
      this.fg = this.bg;
    }
}

   @Input('blackToWhite') set blackToWhite(bow : boolean) {
     if (this.bow == bow) {
       return;
     }
     this.bow = bow;
     this.calcFgBg();
   }

   @Input('invertFlag') set invertFlag(flag : boolean) {
    if (this.invert == flag) {
      return;
    }
    this.invert = flag;
    this.calcFgBg();
  }

  @Input('colorOff') set colorOffFlag(flag : boolean) {
    if (this.colorOff == flag) {
      return;
    }
    this.colorOff = flag;
    this.calcFgBg();
  }

  @Input('localEchoActive') set localEchoActive(flag : boolean) {
    if (this.echoFlag == flag) {
      return;
    }
    this.echoFlag = flag;
    this.calcFgBg();
  }
  
  @Input('localEchoColor') set localEchoColor(col : string) {
    if (this.echoCol == col) {
      return;
    }
    this.echoCol = col;
    this.calcFgBg();
  }

   @Input('ansi2html') set ansi2html(ansi: AnsiData) {
    this.a2h = ansi;
    this.tt = ansi.timeString;// console.log(this.tt);
    this.calcFgBg();
    this.myclasses = '';
    if (ansi.bold) {
      this.myclasses += ' bold';
    }
    if (ansi.italic) {
      this.myclasses += ' italic';
    }
    if (ansi.underline) {
      this.myclasses += ' underline';
    }
    if (ansi.blink) {
      this.myclasses += ' blink';
    }
    if (ansi.crossedout) {
      this.myclasses += ' crossedout';
    }
    if (this.myclasses != ''){
      this.myclasses = this.myclasses.substr(1);
    }
    if (typeof ansi.text !=='undefined' && ansi.text !='') {
      this.txt = ansi.text;
    } else if (typeof ansi.mudEcho !=='undefined' && this.echoFlag) {
      this.txt = ansi.mudEcho;
    } else {
      this.txt = '';
    }
}
  ngOnInit() {
  }

}
