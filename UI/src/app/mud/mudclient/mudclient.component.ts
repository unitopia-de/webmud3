import { Component, OnInit, ViewChild, ElementRef, HostListener, OnDestroy, ChangeDetectorRef, Input } from '@angular/core';
import { SocketService } from '../../shared/socket.service';
import { MudMessage } from '../mud-message';
import { DebugData } from '../debug-data';
import { AnsiService } from '../ansi.service';
import { AnsiData } from '../ansi-data';
import { ConfigService } from '../../shared/config.service';
import { WebmudConfig } from '../webmud-config';

@Component({
  selector: 'app-mudclient',
  templateUrl: './mudclient.component.html',
  styleUrls: ['./mudclient.component.css']
})
export class MudclientComponent implements OnInit,OnDestroy {

  @Input() cfg : WebmudConfig;
  @ViewChild('mudBlock') mudBlock : ElementRef;
  @ViewChild('mudInput') mudInput: ElementRef;

  private mudc_id : string;
  private mudName : string = 'disconnect';
  private connected : boolean;
  public freeParam : boolean = true;
  public inpType : string = 'text';
  private mudc_width : number;
  private mudc_height : number;
  private obs_connect;
  private obs_connected;
  private obs_data;
  private obs_debug;
  private obs_signals;
  private ansiCurrent: AnsiData;
  public mudlines : AnsiData[] = [];
  public messages : MudMessage[] = [];
  public inpmessage : string;
  private inpHistory : string[] = [];
  private inpPointer : number = -1;
  public lastdbg : DebugData;
  
  constructor(
    private socketService: SocketService,
    private ansiService:AnsiService,
    private cdRef:ChangeDetectorRef,
    private cfgService:ConfigService) { 

    }

    private connect() {
    if (this.mudName.toLowerCase() == 'disconnect') {
      if (this.mudc_id) {
        if (this.obs_debug) this.obs_debug.unsubscribe();
        if (this.obs_data) this.obs_data.unsubscribe();
        if (this.obs_signals) this.obs_signals.unsubscribe();
        if (this.obs_connect) this.obs_connect.unsubscribe();// including disconnect
        this.connected = false;
        this.mudc_id = undefined;
        return;
      }
    }
    const other = this;
    const mudOb = {mudname:this.mudName,height:this.mudc_height,width:this.mudc_width}; // TODO options???
    if (this.cfg.autoUser != '') {
      mudOb['user'] = this.cfg.autoUser;
      mudOb['token'] = this.cfg.autoToken;
      mudOb['password'] = this.cfg.autoPw || '';
    }
    this.obs_connect = this.socketService.mudConnect(mudOb).subscribe(_id => {
      other.mudc_id = _id;
      other.obs_connected = other.socketService.mudConnectStatus(_id).subscribe(
          flag => {other.connected = flag;
        });
      other.obs_signals = other.socketService.mudReceiveSignals(_id).subscribe( 
          musi => {
            switch (musi.signal) {
              case 'NOECHO-START': other.inpType = 'password'; break;
              case 'NOECHO-END':   other.inpType = 'text'; break;
              case 'Sound.Play.Once':
                console.log("Play: ",musi.playSoundFile);
                let audio = new Audio();
                audio.src = musi.playSoundFile;
                audio.load();
                audio.play();
                break;
            }
          });
      other.obs_data = other.socketService.mudReceiveData(_id).subscribe(outline => {
          var outp = outline;
          const idx = outline.indexOf(other.ansiService.ESC_CLRSCR);
          if (idx >=0) {
            other.messages = [];
            other.mudlines = [];
          }
          other.ansiCurrent.ansi = outp;
          const a2harr = other.ansiService.processAnsi(other.ansiCurrent);
          for (var ix=0;ix<a2harr.length;ix++) {
            //console.log('main-'+ix+":"+JSON.stringify(a2harr[ix]));
            if (a2harr[ix].text!='') {
              other.mudlines = other.mudlines.concat(a2harr[ix]);
            }
          }
          other.ansiCurrent = a2harr[a2harr.length-1];
          other.messages.push({text:outp});
        });
      other.obs_debug = other.socketService.mudReceiveDebug(_id).subscribe(debugdata => {
          other.lastdbg = debugdata;
        });
    });
  }

  ngOnInit() { 
    this.ansiCurrent = new AnsiData();
    console.log('cfg:',JSON.stringify(this.cfg));
    if (typeof this.cfg !== 'undefined' && typeof this.cfg.mudname !== 'undefined'
        && this.cfg.mudname !== '') {
      this.mudName = this.cfg.mudname;
      this.freeParam = false;
    } 
  }

  ngAfterViewInit() {
    var oh = this.mudBlock.nativeElement.offsetHeight;
    var ow = this.mudBlock.nativeElement.offsetWidth;
    this.mudc_width = Math.floor(ow/7.5);
    this.mudc_height = Math.floor(oh/16);
    console.log('MudSize: '+this.mudc_width+'x'+this.mudc_height);
    this.cfgService.setMudOutputSize(oh,ow);
    if (!this.freeParam) {
      if (this.cfg.autoConnect) {
        this.connect();
      }
    }
  }

  ngOnDestroy() {
    this.obs_debug.unsubscribe();
    this.obs_data.unsubscribe();
    this.obs_connect.unsubscribe();// including disconnect
    this.obs_connected.unsubscribe(); 
  }

  sendMessage() {
    this.socketService.mudSendData(this.mudc_id,this.inpmessage);
    if (this.inpType == 'text' && this.inpmessage != '' 
        && (this.inpHistory.length==0 || (this.inpHistory.length >0 && this.inpHistory[0] != this.inpmessage))) {
      this.inpHistory.unshift(this.inpmessage);
    }
    this.inpmessage = '';
  }

  onSelectMud(mudselection : string) {
    if (mudselection.toLowerCase() == 'disconnect') {
      this.messages = [];
      this.mudlines = [];
    }
    this.mudName = mudselection;
    this.ansiCurrent = new AnsiData();
    this.connect();
  }
  onKeyUp(event:KeyboardEvent) {
    if (this.inpType !='text') return;
    switch (event.key) {
      case "ArrowUp":
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
            if (this.inpHistory.length>0 && this.inpmessage == this.inpHistory[0]) {
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
          if (this.inpHistory.length > this.inpPointer) {
            return; // at the end...
          }
          this.inpmessage = this.inpHistory[this.inpPointer];
        }
        return;
       case "ArrowDown":
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
      case "ArrowLeft":
      case "ArrowRight":
      case "Shift":
      case "Ctrl":
      case "Alt":
      case "AltGraph":
      case "Meta":
        return; // no change to the pointer...
      case "Enter":
        this.inpPointer = -1;
        return;
      default:
        this.inpPointer = -1;
        return;
    }
  }

  @HostListener('click')
  public autofocusInput() {
    this.mudInput.nativeElement.focus();
  }


}
