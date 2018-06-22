import { Component, OnInit, Input } from '@angular/core';
import { Ansi2Html } from '../shared/ansi2html';

@Component({
  selector: 'app-mudspan',
  templateUrl: './mudspan.component.html',
  styleUrls: ['./mudspan.component.css']
})
export class MudspanComponent implements OnInit {

  constructor() { }

  private a2h :Ansi2Html;
  private myclasses : string;
  private fg:string;
  private bg:string;
  private txt:string;

   @Input('ansi2html') set ansi2html(ansi: Ansi2Html) {
    this.a2h = ansi;
    if (ansi.reverse) {
      this.fg = ansi.bg_rgb;
      this.bg = ansi.fg_rgb;
    } else {
      this.fg = ansi.fg_rgb;
      this.bg = ansi.bg_rgb;
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
