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

  private calcFgBg() {
    var lfg,lbg;
    if (typeof this.a2h === 'undefined') {
      return;
    }
    if ((this.a2h.reverse && !this.invert)||(!this.a2h.reverse && this.invert)) {
      lfg = this.a2h.bgcolor;
      lbg = this.a2h.fgcolor;
    } else {
      lfg = this.a2h.fgcolor;
      lbg = this.a2h.bgcolor;
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

   @Input('ansi2html') set ansi2html(ansi: AnsiData) {
    this.a2h = ansi;
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
    if (typeof ansi.text !=='undefined') {
      this.txt = ansi.text;
    } else {
      this.txt = '';
    }
}
  ngOnInit() {
  }

}
