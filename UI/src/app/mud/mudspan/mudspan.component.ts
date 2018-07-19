import { Component, OnInit, Input } from '@angular/core';
import { AnsiData } from '../ansi-data';

@Component({
  selector: 'app-mudspan',
  template:'<span display="inline" [ngClass]="myclasses" [style.color]="fg" [style.background]="bg">{{txt}}</span>',
  // templateUrl: './mudspan.component.html',
  styleUrls: ['./mudspan.component.css']
})
export class MudspanComponent implements OnInit {

  constructor() { }

  private a2h :AnsiData;
  private myclasses : string;
  private fg:string;
  private bg:string;
  private txt:string;

   @Input('ansi2html') set ansi2html(ansi: AnsiData) {
    this.a2h = ansi;
    if (ansi.reverse) {
      this.fg = ansi.bgcolor;
      this.bg = ansi.fgcolor;
    } else {
      this.fg = ansi.fgcolor;
      this.bg = ansi.bgcolor;
    }
    if (ansi.concealed) {
      this.fg = this.bg;
    }
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
