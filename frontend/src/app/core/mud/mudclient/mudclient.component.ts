/* eslint @typescript-eslint/no-this-alias: "warn" */
import {
  AfterViewChecked,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Inject,
  Input,
  ViewChild,
} from '@angular/core';
import { DialogService } from 'primeng/dynamicdialog';
import { AnsiData } from '../ansi-data';
import { AnsiService } from '../ansi.service';
import { ColorSettings } from '../../../shared/color-settings';

import { WebmudConfig } from '../webmud-config';
import { Title } from '@angular/platform-browser';
import { MudMessage, MudSignalHelpers } from '../mud-signals';
import { InventoryList } from "../../../shared/inventory-list";
import { FilesService } from '../files.service';
import { CookieService } from 'ngx-cookie-service';
import { CharacterData, KeypadData, ServerConfigService, WINDOW, WindowConfig, WindowService } from '@mudlet3/frontend/shared';
import { ColorSettingsComponent } from '@mudlet3/frontend/features/settings';
import { KeypadConfigComponent } from '@mudlet3/frontend/features/modeless';
import { MudConfig } from '@mudlet3/frontend/features/mudconfig';
import { IoMud, SocketsService } from '@mudlet3/frontend/features/sockets';

@Component({
  selector: 'app-mudclient',
  templateUrl: './mudclient.component.html',
  styleUrls: ['./mudclient.component.scss'],
})
export class MudclientComponent implements AfterViewChecked {
  @Input() cfg: WebmudConfig;
  @ViewChild('mudBlock', { static: false }) mudBlock: ElementRef;
  @ViewChild('mudInputLine', { static: false }) mudInputLine: ElementRef;
  @ViewChild('mudInputArea', { static: false }) mudInputArea: ElementRef;
  @ViewChild('mudTest', { static: false }) mudTest: ElementRef;
  @ViewChild('mudMenu', { static: false }) mudMenu: ElementRef;
  @ViewChild('scroller', { static: false }) scroller: ElementRef;

  public v = {
    // visualize-parameters
    connected: false,
    scrollLock: true,
    sizeCalculated: false,
    sizeCalculated2: false,
    inpType: 'text',
    ref_width: 615,
    ref_height: 320,
    stdfg: 'white',
    stdbg: 'black',
    scrolltop: 0,
  };
  public cs: ColorSettings = {
    invert: false,
    blackOnWhite: false,
    colorOff: false,
    localEchoColor: '#a8ff00',
    localEchoBackground: '#000000',
    localEchoActive: true,
  };
  public keySetters: KeypadData = new KeypadData();
  private d = {
    ref_height_ratio: 1,
    mudc_height: 90,
    mudc_width: 80,
    startCnt: 0,
  };
  private mudName = 'disconnect';
  public mudc_id: string;
  private ioMud: IoMud;
  public mudlines: AnsiData[] = [];
  private ansiCurrent: AnsiData;
  public inpmessage: string;
  private inpHistory: string[] = [];
  public togglePing = false;
  private inpPointer = -1;
  public messages: MudMessage[] = [];
  public filesWindow: WindowConfig;
  public charStatsWindow: WindowConfig;
  public charData: CharacterData;
  public invlist: InventoryList;
  public changeFocus = 1;
  public previousFoxus = 1;

  private obs_connect: any;
  //   private obs_connected:any;
  private obs_data: any;
  private obs_debug: any;
  private obs_signals: any;

  scroll() {
    this.mudBlock.nativeElement.scrollTo(
      this.scroller.nativeElement.scrollLeft,
      0,
    );
  }
  doFocus() {
    let FirstFocus = undefined;
    this.previousFoxus = this.changeFocus;
    if (this.v.inpType != 'text' && typeof this.mudInputLine !== 'undefined') {
      FirstFocus = this.mudInputLine.nativeElement;
      this.changeFocus = 1;
      console.log('doFocus-2-inputline', this.changeFocus, this.previousFoxus);
    } else if (
      this.v.inpType == 'text' &&
      typeof this.mudInputArea !== 'undefined'
    ) {
      FirstFocus = this.mudInputArea.nativeElement;
      // this.changeFocus = -1;
      console.log('doFocus-1-inputarea', this.changeFocus, this.previousFoxus);
    } else if (this.v.inpType != 'text') {
      this.changeFocus = 2;
      return;
    } else if (this.v.inpType == 'text') {
      this.changeFocus = -2;
      return;
    }
    if (FirstFocus) {
      FirstFocus.focus();
      FirstFocus.select();
    }
  }
  menuAction(act: any) {
    console.log('menuAction', act);
    let numpadOther, other;
    let numpadSplit: string[] = [];
    switch (act.item.id) {
      case 'MUD:MENU':
        return; // no action/with submenu!
      default:
        if (act.item.id.startsWith('MUD:CONNECT:')) {
          const mudkey = act.item.id.split(':')[2];
          console.log(act.item.id);
          this.mudName = mudkey;
          this.connect();
          this.changeFocus = -3;
        }
        return;
      case 'MUD:CONNECT':
        if (
          typeof this.cfg !== 'undefined' &&
          typeof this.cfg.mudname !== 'undefined' &&
          this.cfg.mudname !== ''
        ) {
          this.mudName = this.cfg.mudname;
          this.connect();
          this.changeFocus = -4;
        }
        return;
      case 'MUD:DISCONNECT':
        this.mudName = 'disconnect';
        this.connect();
        return;
      case 'MUD:SCROLL':
        this.v.scrollLock = !this.v.scrollLock;
        return;
      case 'MUD:NUMPAD':
        this.dialogService.open(KeypadConfigComponent, {
          data: {
            keypad: this.keySetters,
            cb: this.menuAction,
            cbThis: this,
          },
          header: 'NumPad-Belegung',
          width: '90%',
        });
        return;
      case 'MUD:NUMPAD:RETURN':
        numpadOther = act.item.cbThis;
        numpadOther.keySetters = act.item.keypad;
        console.log('MUD:NUMPAD:RETURN', act.item.event);
        numpadSplit = act.item.event.split(':');
        if (numpadSplit[2] == 'undefined') {
          numpadSplit[2] = '';
        }
        numpadOther.keySetters.addKey(
          numpadSplit[0],
          numpadSplit[1],
          numpadSplit.slice(2).join(':'),
        );
        numpadOther.socketsService.sendGMCP(
          numpadOther.mudc_id,
          'Numpad',
          'Update',
          {
            prefix: numpadSplit[0],
            key: numpadSplit[1],
            value: numpadSplit.slice(2).join(':'),
          },
        );
        // doEvent: act.item.event
        return;
      case 'MUD:VIEW':
        this.dialogService.open(ColorSettingsComponent, {
          data: {
            cs: this.cs,
            cb: this.menuAction,
            v: this.v,
            cbThis: this,
          },
          header: 'Change Colors',
          width: '40%',
        });
        return;
      case 'MUD_VIEW:COLOR:RETURN':
        this.cs = act.item.cs;
        other = act.item.cbThis;
        if (this.cs.blackOnWhite) {
          this.v.stdfg = 'black';
          this.v.stdbg = 'white';
        } else {
          this.v.stdfg = 'white';
          this.v.stdbg = 'black';
        }
        // console.log('cs=',other.cs,tmpJson,tmp64);
        other.cookieService.set(
          'mudcolors',
          other.ansiService.toBinaryBase64(JSON.stringify(this.cs)),
        );
        return;
    }
  }

  private wordWrap(str: string, cols: number): string {
    let formatedString = '',
      fstr = '',
      wordsArray = [];
    wordsArray = str.split(' ');
    fstr = wordsArray[0];
    for (let i = 1; i < wordsArray.length; i++) {
      if (wordsArray[i].length > cols) {
        formatedString += fstr + '\r\n';
        fstr = wordsArray[i];
      } else {
        if (fstr.length + wordsArray[i].length > cols) {
          formatedString += fstr + '\r\n';
          fstr = wordsArray[i];
        } else {
          fstr += ' ' + wordsArray[i];
        }
      }
    }
    formatedString += fstr + '\r\n';
    return formatedString;
  }
  public tableOutput(words: string[], screen: number): string {
    let width = 1;
    words.forEach((word) => {
      if (word.length > width) {
        width = word.length;
      }
    });
    width++;
    const cols = Math.max(1, Math.floor((screen + 1) / (width + 1)));
    const lines = Math.floor((words.length + cols - 1) / cols);
    width = Math.max(width + 1, Math.floor((screen + 1) / cols));
    const r: string[] = [];
    for (let line = 0; line < lines; line++) {
      let s = '';
      const colMin = Math.min(
        cols,
        Math.floor((words.length - line + lines - 1) / lines),
      );
      for (let col = 0; col < colMin; col++) {
        const word = words[line + col * lines];
        const len = width - word.length;
        s += word + ' '.repeat(len);
      }
      r.push(s);
    }
    return '\r\n' + r.join('\r\n');
  }

  private localEcho(other: any, inp: string) {
    other.ansiCurrent.ansi = '';
    other.ansiCurrent.mudEcho = other.wordWrap(inp, 75);
    // other.messages.push({text:this.inpmessage+'\r\n'});
    const ts = new Date();
    other.ansiCurrent.timeString =
      (ts.getDate() < 10 ? '0' : '') +
      ts.getDate() +
      '.' +
      (ts.getMonth() + 1 < 10 ? '0' : '') +
      (ts.getMonth() + 1) +
      '.' +
      ts.getFullYear() +
      ' ' +
      (ts.getHours() < 10 ? '0' : '') +
      ts.getHours() +
      ':' +
      (ts.getMinutes() < 10 ? '0' : '') +
      ts.getMinutes() +
      ':' +
      (ts.getSeconds() < 10 ? '0' : '') +
      ts.getSeconds();
    //console.debug('mudclient-sendMessage-ansiCurrent-before',this.mudc_id,other.ansiCurrent);
    const a2harr = other.ansiService.processAnsi(other.ansiCurrent);
    //console.debug('mudclient-sendMessage-s2harr after',this.mudc_id,a2harr);
    for (let ix = 0; ix < a2harr.length; ix++) {
      if (a2harr[ix].text != '' || typeof a2harr[ix].mudEcho !== 'undefined') {
        other.mudlines = other.mudlines.concat(a2harr[ix]);
      }
    }
    other.ansiCurrent = a2harr[a2harr.length - 1];
  }

  sendMessage() {
    const other = this;
    this.socketsService.mudSendData(this.mudc_id, this.inpmessage);
    if (this.v.inpType == 'text' && this.inpmessage != '') {
      this.localEcho(other, this.inpmessage);
      if (
        this.inpHistory.length == 0 ||
        (this.inpHistory.length > 0 && this.inpHistory[0] != this.inpmessage)
      ) {
        this.inpHistory.unshift(this.inpmessage);
      }
    }
    this.inpmessage = '';
  }

  onKeyDown(event: KeyboardEvent) {
    if (this.v.inpType != 'text') return;
    let modifiers = '';
    if (event.shiftKey) {
      modifiers += 'Shift';
    }
    if (event.ctrlKey) {
      modifiers += 'Ctrl';
    }
    if (event.altKey) {
      modifiers += 'Alt';
    }
    if (event.metaKey) {
      modifiers += 'Meta';
    }
    if (modifiers == 'CtrlAlt') return;
    if (modifiers == '' && event.key == 'Enter') {
      event.returnValue = false;
      event.preventDefault();
      this.sendMessage();
      return;
    }
    if (typeof this.keySetters === 'undefined') {
      console.log('keydown-1', modifiers, event.code);
      return;
    }
    if (event.code.startsWith('Numpad') || event.code.startsWith('F')) {
      modifiers += '|' + event.code;
      const inp = this.keySetters.getCompoundKey(modifiers);
      if (typeof inp !== 'undefined') {
        if (inp !== '') {
          this.socketsService.mudSendData(this.mudc_id, inp);
          this.localEcho(this, inp); // TODO abschaltbar
        }
        event.returnValue = false;
        event.preventDefault();
        return;
      } else {
        console.log('keydown-2', modifiers, event.code);
      }
    }
  }

  onKeyUp(event: KeyboardEvent) {
    let a2h: AnsiData;
    if (this.v.inpType != 'text') return;
    switch (event.key) {
      case 'ArrowUp':
        if (this.inpHistory.length < this.inpPointer) {
          return; // at the end.....
        }
        if (this.inpPointer < 0) {
          if (this.inpmessage == '') {
            if (this.inpHistory.length > 0) {
              this.inpPointer = 0;
              this.inpmessage = this.inpHistory[0];
              return;
            } else {
              return;
            }
          } else {
            if (
              this.inpHistory.length > 0 &&
              this.inpmessage == this.inpHistory[0]
            ) {
              return;
            }
            this.inpHistory.unshift(this.inpmessage);
            if (this.inpHistory.length > 1) {
              this.inpPointer = 1;
              this.inpmessage = this.inpHistory[1];
              return;
            } else {
              this.inpPointer = 0;
              return;
            }
          }
        } else {
          this.inpPointer++;
          if (this.inpHistory.length < this.inpPointer) {
            return; // at the end...
          }
          this.inpmessage = this.inpHistory[this.inpPointer];
        }
        return;
      case 'ArrowDown':
        if (this.inpPointer < 0) {
          return; // at the beginning
        }
        this.inpPointer--;
        if (this.inpPointer < 0) {
          this.inpmessage = '';
          return; // at the beginning
        }
        this.inpmessage = this.inpHistory[this.inpPointer];
        return;
      case 'ArrowLeft':
        return;
      case 'ArrowRight':
      case 'Shift':
      case 'Ctrl':
      case 'Alt':
      case 'AltGraph':
      case 'Meta':
        return; // no change to the pointer...
      case 'Enter':
        this.inpPointer = -1;
        a2h = Object.assign({}, this.mudlines[this.mudlines.length - 1]);
        a2h.text = '\r\n';
        this.mudlines.push(a2h);
        return;
      case 'Tab':
        this.socketsService.sendGMCP(
          this.ioMud.MudId,
          'Input',
          'Complete',
          this.inpmessage,
        );
        return;
      default:
        this.inpPointer = -1;
        return;
    }
  }

  private connect() {
    console.log('S95-mudclient-connecting-1', this.mudName);
    if (this.mudName.toLowerCase() == 'disconnect') {
      if (this.mudc_id) {
        if (typeof this.ioMud !== undefined) {
          this.ioMud.disconnectFromMudClient(this.mudc_id);
          this.ioMud = undefined;
        }
        console.info('S95-mudclient-disconnect', this.mudc_id);
        if (this.obs_debug) this.obs_debug.unsubscribe();
        if (this.obs_data) this.obs_data.unsubscribe();
        if (this.obs_signals) this.obs_signals.unsubscribe();
        if (this.obs_connect) this.obs_connect.unsubscribe(); // including disconnect
        this.v.connected = false;
        this.mudc_id = undefined;
        return;
      }
    }
    const other = this;
    const mudOb: MudConfig = {
      mudname: this.mudName,
      height: this.d.mudc_height,
      width: this.d.mudc_width,
    }; // TODO options???
    this.titleService.setTitle(
      this.srvcfgService.getWebmudName() + ' ' + this.mudName,
    ); // TODO portal!!!
    if (this.cfg.autoUser != '') {
      mudOb['user'] = this.cfg.autoUser;
      mudOb['token'] = this.cfg.autoToken;
      mudOb['password'] = this.cfg.autoPw || '';
    }
    console.log('S95-mudclient-connecting-2', mudOb);
    this.obs_connect = this.socketsService.mudConnect(mudOb).subscribe(
      (ioResult) => {
        switch (ioResult.IdType) {
          case 'IoMud:SendToAllMuds':
            MudSignalHelpers.mudProcessData(other, other.ioMud.MudId, [
              ioResult.MsgType,
              undefined,
            ]);
            // console.warn("S96-check SendToAllMuds",ioResult);
            return;
          case 'IoMud':
            other.ioMud = ioResult.Data as IoMud;
            other.v.connected = this.ioMud.connected;
            switch (ioResult.MsgType) {
              case 'mud-connect':
                other.mudc_id = other.ioMud.MudId;
                other.v.connected = true;
                return;
              case 'mud-signal':
                MudSignalHelpers.mudProecessSignals(
                  other,
                  ioResult.musi,
                  other.ioMud.MudId,
                );
                return;
              case 'mud-output':
                MudSignalHelpers.mudProcessData(other, other.ioMud.MudId, [
                  ioResult.ErrorType,
                  undefined,
                ]);
                return;
              case 'mud-disconnect':
                other.v.connected = false;
                MudSignalHelpers.mudProcessData(other, other.ioMud.MudId, [
                  ioResult.ErrorType,
                  undefined,
                ]);
                return;
              default:
                console.warn('S96-unknown MsgType with IoMud', ioResult);
            }
            break;
          default:
            console.warn('S96-unknown idType', ioResult);
        }
      },
      (error) => {
        console.error(error);
      },
    );
    return;
    // this.obs_connect = this.socketService.mudConnect(mudOb).subscribe(_id => {
    //   console.log("S05-mudclient-connecting-3",_id);
    //   if (_id == null) {
    //     other.v.connected = false;
    //     other.mudc_id = undefined;
    //     console.error('mudclient-socketService.mudConnect-failed',_id);
    //     return;
    //   }
    //   other.mudc_id = _id;
    //   other.obs_connected = other.socketService.mudConnectStatus(_id).subscribe(
    //       flag => {other.v.connected = flag;
    //       console.log("S05-mudclient-connecting-4",_id,flag);
    //     });
    //   other.obs_signals = other.socketService.mudReceiveSignals(_id).subscribe(
    //       musi => {
    //         MudSignalHelpers.mudProecessSignals(other,musi,_id);
    //   });
    //   other.obs_data = other.socketService.mudReceiveData(_id).subscribe(outline => {
    //     MudSignalHelpers.mudProcessData(other,_id,outline);
    //   });
    // });
  }

  getViewPortHeight(): number {
    return this.window.innerHeight;
  }

  getViewPortWidth(): number {
    return this.window.innerWidth;
  }

  calculateSizing() {
    // let oh = this.mudBlock.nativeElement.offsetHeight;
    const ow = this.mudBlock.nativeElement.offsetWidth;
    let tmpheight = this.getViewPortHeight();
    tmpheight -= this.mudMenu.nativeElement.offsetHeight;
    tmpheight -= 2 * this.mudInputArea.nativeElement.offsetHeight;
    tmpheight = Math.floor(
      Math.floor(tmpheight / this.d.ref_height_ratio) *
        this.d.ref_height_ratio +
        0.5,
    );
    const other = this;
    setTimeout(function () {
      other.v.ref_height = tmpheight;
      // other.v.sizeCalculated2 = true;
      other.cdRef.detectChanges();
    });
    if (this.d.mudc_height != Math.floor(tmpheight / this.d.ref_height_ratio)) {
      this.d.mudc_height = Math.floor(
        tmpheight / (this.d.ref_height_ratio + 1),
      );
      console.debug(
        'MudSize ',
        '' +
          this.d.mudc_width +
          'x' +
          this.d.mudc_height +
          ' <= ' +
          ow +
          'x' +
          tmpheight,
      );
      this.d.startCnt++;
      if (
        this.d.startCnt == 1 &&
        typeof this.mudc_id === 'undefined' &&
        this.cfg.autoConnect
      ) {
        this.connect();
      }
      if (typeof this.mudc_id !== undefined) {
        // this.socketService.setMudOutputSize(this.mudc_id,this.mudc_height,this.mudc_width);
      }
    }
  }

  focusFunction(what: string) {
    console.log('get focus', what);
  }

  focusOutFunction(what: string) {
    console.log('out focus', what);
  }

  ngAfterViewChecked(): void {
    const other = this;

    // [scrollTop]="mudBlock.scrollHeight"
    if (
      this.v.scrollLock &&
      this.mudBlock &&
      this.mudBlock.nativeElement.scrollTop !=
        this.mudBlock.nativeElement.scrollHeight
    ) {
      setTimeout(() => {
        this.mudBlock.nativeElement.scrollTop =
          this.mudBlock.nativeElement.scrollHeight;
      });
    }

    let tmpwidth = this.getViewPortWidth() / 1.0125;
    if (!this.v.sizeCalculated) {
      this.doFocus();
      tmpwidth = this.mudTest.nativeElement.offsetWidth * 1.0125;
      this.d.ref_height_ratio = this.mudTest.nativeElement.offsetHeight / 25.0;
      setTimeout(function () {
        other.v.ref_width = tmpwidth;
        other.v.sizeCalculated = true;
        other.cdRef.detectChanges();
      });
    } else if (this.d.startCnt <= 0) {
      this.calculateSizing();
    }
    if (this.changeFocus != this.previousFoxus) {
      this.doFocus();
    }
  }

  constructor(
    @Inject(WINDOW) private window: Window,
    private cdRef: ChangeDetectorRef,
    private ansiService: AnsiService,
    private dialogService: DialogService,
    private socketsService: SocketsService,
    public filesrv: FilesService,
    public wincfg: WindowService,
    private srvcfgService: ServerConfigService,
    private titleService: Title,
    private cookieService: CookieService,
  ) {
    this.invlist = new InventoryList();
    this.ansiCurrent = new AnsiData();
    this.mudc_id = 'one';

    const ncs = this.cookieService.get('mudcolors');
    // console.log("mudcolors '"+ncs+"'");
    if (ncs != '') {
      this.cs = JSON.parse(ansiService.fromBinaryBase64(ncs));
    }
    if (this.cs.blackOnWhite) {
      this.v.stdfg = 'black';
      this.v.stdbg = 'white';
    } else {
      this.v.stdfg = 'white';
      this.v.stdbg = 'black';
    }
    // this.connect();
  }
}
