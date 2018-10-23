import { Component, OnInit, ViewChild, ElementRef, HostListener, OnDestroy, ChangeDetectorRef, Input, AfterViewChecked } from '@angular/core';
import { SocketService } from '../../shared/socket.service';
import { MudMessage } from '../mud-message';
import { DebugData } from '../debug-data';
import { AnsiService } from '../ansi.service';
import { AnsiData } from '../ansi-data';
import { ConfigService } from '../../shared/config.service';
import { WebmudConfig } from '../webmud-config';
import { standardizeConfig } from '@angular/router/src/config';
import { ServerConfigService } from '../../shared/server-config.service';

@Component({
  selector: 'app-mudclient',
  templateUrl: './mudclient.component.html',
  styleUrls: ['./mudclient.component.css']
})
export class MudclientComponent implements AfterViewChecked,OnInit,OnDestroy {

  @Input() cfg : WebmudConfig;
  @ViewChild('mudBlock') mudBlock : ElementRef;
  @ViewChild('mudInput') mudInput: ElementRef;
  @ViewChild('mudTest') mudTest: ElementRef;
  @ViewChild('mudMenu') mudMenu : ElementRef;
  @ViewChild('scroller') scroller: ElementRef; 

  private mudc_id : string;
  private mudName : string = 'disconnect';
  public connected : boolean;
  public sizeCalculated : boolean = false;
  public sizeCalculated2 : boolean = false;
  public inpType : string = 'text';
  private mudc_width : number = 80;
  private mudc_height : number;
  public ref_width : number;
  public ref_height: number;
  private ref_height_ratio:number;
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
  private startCnt : number = 0;
  public togglePing : boolean = false;
  public colourInvert : boolean = false;
  public stdfg : string ='white';
  public stdbg : string ='black';
  public blackOnWhite: boolean = false;
  public colorOff : boolean=false;

  scroll() {
    this.mudBlock.nativeElement.scrollTo(this.scroller.nativeElement.scrollLeft,0);
  }
  
  constructor(
    private socketService: SocketService,
    private ansiService:AnsiService,
    private cdRef:ChangeDetectorRef,
    private cfgService:ConfigService,
    private srvcfgService:ServerConfigService) { 

    }

    menuAction(act : string) {
      switch(act) {
        case 'connect':
            if (typeof this.cfg !== 'undefined' && typeof this.cfg.mudname !== 'undefined'
                  && this.cfg.mudname !== '') {
              this.mudName = this.cfg.mudname;
              this.connect();
            } 
            return;
        case 'disconnect':
            this.mudName = 'disconnect';
            this.connect();
            return;
        case 'loginPortal': return; // TODO  redirect to /login.
        case 'colorOff=true':  this.colorOff = true; break;
        case 'colorOff=false': this.colorOff = false; break;
        case 'invert=true':  this.colourInvert = true; break;
        case 'invert=false': this.colourInvert = false; break;
        case 'blackOnWhite=true':  this.blackOnWhite=true; break;
        case 'blackOnWhite=false': this.blackOnWhite=false; break;
        case 'ping':
            this.socketService.sendPing(this.mudc_id);
            return;
        default: return;
      }
      if (this.blackOnWhite || this.colourInvert) {
        this.stdbg = 'white';this.stdfg = 'black';
      } else {
        this.stdbg = 'black';this.stdfg = 'white'; 
      }
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
      if (_id == null) {
        other.connected = false;
        other.mudc_id = undefined;
        return;
      }
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
                // console.log("Play: ",musi.playSoundFile);
                let audio = new Audio();
                audio.src = musi.playSoundFile;
                audio.load();
                audio.play();
                break;
              case 'Core.Ping':
                this.togglePing = !this.togglePing;
                break;
              case 'Core.GoodBye':
              default:
                console.log('mud-signal: ',musi);
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
          var ts = new Date();
          other.ansiCurrent.timeString = ((ts.getDate() < 10)?"0":"") + ts.getDate() +"."
                                       + (((ts.getMonth()+1) < 10)?"0":"") + (ts.getMonth()+1) +"."
                                       + ts.getFullYear() + ' '
                                       +((ts.getHours() < 10)?"0":"") + ts.getHours() +":"
                                       + ((ts.getMinutes() < 10)?"0":"") + ts.getMinutes() +":"
                                       + ((ts.getSeconds() < 10)?"0":"") + ts.getSeconds();
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
    } 
  }

  calculateSizing() {
    // var oh = this.mudBlock.nativeElement.offsetHeight;
    var ow = this.mudBlock.nativeElement.offsetWidth;
    var tmpheight = this.srvcfgService.getViewPortHeight();
    tmpheight -= 2*this.mudMenu.nativeElement.offsetHeight;
    tmpheight -= 2*this.mudInput.nativeElement.offsetHeight;
    tmpheight = Math.floor(Math.floor(tmpheight/(this.ref_height_ratio))*this.ref_height_ratio+0.5);
    var other = this;
    setTimeout(function(){
      other.ref_height = tmpheight;
      // other.sizeCalculated2 = true;
      other.cdRef.detectChanges();
    });
    if (this.mudc_height != Math.floor(tmpheight/this.ref_height_ratio)) {
      this.mudc_height = Math.floor(tmpheight/(this.ref_height_ratio+1));
      console.log('MudSize: '+this.mudc_width+'x'+this.mudc_height+' <= '+ow+'x'+tmpheight);
      this.startCnt++;
      if (this.startCnt == 1 && typeof this.mudc_id === 'undefined' && this.cfg.autoConnect) {
        this.connect();
      }
      if (typeof this.mudc_id !== undefined) {
        this.socketService.setMudOutputSize(this.mudc_id,this.mudc_height,this.mudc_width);
      }
    }
  }

  ngAfterViewChecked() {
    var other = this;
    var tmpwidth;
    if (!this.sizeCalculated) {
      tmpwidth = this.mudTest.nativeElement.offsetWidth * 1.0125;
      this.ref_height_ratio = this.mudTest.nativeElement.offsetHeight/25.0;
      setTimeout(function(){
        other.ref_width = tmpwidth;
        other.sizeCalculated = true;
        other.cdRef.detectChanges();
      });
    } else if (this.startCnt <= 0) {
      this.calculateSizing();
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
    var a2h : AnsiData;
    if (this.inpType !='text') return;
    switch (event.key) {
      case "ArrowUp":
        //console.log("INP-1:",this.inpPointer,this.inpHistory.length);
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
          if (this.inpHistory.length < this.inpPointer) {
            return; // at the end...
          }
          this.inpmessage = this.inpHistory[this.inpPointer];
        }
        return;
       case "ArrowDown":
        //console.log("INP-2:",this.inpPointer,this.inpHistory.length);
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
        //console.log("INP-3:",this.inpPointer,this.inpHistory.length);
        return;
      case "ArrowRight":
      case "Shift":
      case "Ctrl":
      case "Alt":
      case "AltGraph":
      case "Meta":
        return; // no change to the pointer...
      case "Enter":
        this.inpPointer = -1;
        a2h = Object.assign({},this.mudlines[this.mudlines.length-1]);
        a2h.text = "\r\n";
        this.mudlines.push(a2h);
        return;
      default:
        this.inpPointer = -1;
        return;
    }
  }

  @HostListener('window:resize', ['$event'])
onResize(event) {
  this.calculateSizing();
}

}
