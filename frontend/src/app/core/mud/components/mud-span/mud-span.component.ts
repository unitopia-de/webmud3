import { Component, Input } from '@angular/core';
import { BehaviorSubject, map, Observable, startWith } from 'rxjs';

import { IMudMessage } from '../../types/mud-message';

@Component({
  selector: 'app-mud-span',
  templateUrl: './mud-span.component.html',
  styleUrls: ['./mud-span.component.scss'],
  standalone: false,
})
export class MudspanComponent {
  private readonly lineSubject = new BehaviorSubject<IMudMessage | null>(null);

  public readonly line$ = this.lineSubject.asObservable();

  public readonly classes$: Observable<string | null>;

  public readonly foreground$: Observable<string>;

  public readonly background$: Observable<string>;

  constructor() {
    this.classes$ = this.line$.pipe(
      map((line) => {
        if (!line) return null;
        let classes = '';
        if (line.bold) classes += ' bold';
        if (line.italic) classes += ' italic';
        if (line.underline) classes += ' underline';
        if (line.blink) classes += ' blink';
        if (line.crossedout) classes += ' crossedout';
        if (line.faint) classes += ' faint';
        if (classes) classes = classes.trim();
        return classes === '' ? null : classes;
      }),
    );

    this.foreground$ = this.line$.pipe(
      map((line) => line?.fgcolor || '#ffffff'),
      startWith('#ffffff'),
    );

    this.background$ = this.line$.pipe(
      map((line) => line?.bgcolor || '#000000'),
      startWith('#000000'),
    );
  }

  public get line(): IMudMessage | null {
    return this.lineSubject.value;
  }

  @Input()
  public set line(value: IMudMessage | null) {
    this.lineSubject.next(value);
  }

  // private calcFgBg() {
  //   let lfg, lbg;
  //   if (typeof this.a2h === 'undefined' || this._colorOff) {
  //     if (this.bow || this.invert) {
  //       this.fg = '#000000';
  //       this.bg = '#ffffff';
  //     } else {
  //       this.fg = '#ffffff';
  //       this.bg = '#000000';
  //     }
  //     return;
  //   }
  //   if (this.a2h.reverse) {
  //     lfg = this.a2h.bgcolor;
  //     lbg = this.a2h.fgcolor;
  //   } else {
  //     lfg = this.a2h.fgcolor;
  //     lbg = this.a2h.bgcolor;
  //   }
  //   if (this.invert) {
  //     lfg = invColor(lfg);
  //     lbg = invColor(lbg);
  //   }
  //   // if (typeof this.a2h.text !== 'undefined' && this.a2h.text != '') {
  //   //   // no change
  //   // } else if (typeof this.a2h.mudEcho !== 'undefined') {
  //   //   if (this.echoFlag) {
  //   //     this.txt = this.a2h.mudEcho;
  //   //     lfg = this.echoCol;
  //   //     lbg = this.echoBak;
  //   //   } else {
  //   //     this.txt = '';
  //   //   }
  //   // }
  //   if (!this.bow) {
  //     this.fg = lfg;
  //     this.bg = lbg;
  //   } else {
  //     this.fg = invertGrayscale(lfg);
  //     this.bg = invertGrayscale(lbg);
  //   }

  //   if (this.a2h.concealed) {
  //     this.fg = this.bg;
  //   }
  // }

  // @Input() set blackToWhite(bow: boolean) {
  //   if (this.bow == bow) {
  //     return;
  //   }
  //   this.bow = bow;
  //   this.calcFgBg();
  // }

  // @Input() set invertFlag(flag: boolean) {
  //   if (this.invert == flag) {
  //     return;
  //   }
  //   this.invert = flag;
  //   this.calcFgBg();
  // }

  // @Input() set colorOff(flag: boolean) {
  //   if (this._colorOff == flag) {
  //     return;
  //   }
  //   this._colorOff = flag;
  //   this.calcFgBg();
  // }

  // @Input() set localEchoActive(flag: boolean) {
  //   if (this.echoFlag == flag) {
  //     return;
  //   }
  //   this.echoFlag = flag;
  //   this.calcFgBg();
  // }

  // @Input() set localEchoColor(col: string) {
  //   if (this.echoCol == col) {
  //     return;
  //   }
  //   this.echoCol = col;
  //   this.calcFgBg();
  // }

  // @Input() set localEchoBackground(col: string) {
  //   if (this.echoBak == col) {
  //     return;
  //   }
  //   this.echoBak = col;
  //   this.calcFgBg();
  // }
}
