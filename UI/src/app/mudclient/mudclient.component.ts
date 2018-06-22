import { Component, OnInit, ViewChild, ElementRef, HostListener } from '@angular/core';
import { SocketService } from '../shared/socket.service';
import { MudMessage } from '../shared/mud-message';
import { DebugData } from '../shared/debug-data';
import { AnsiService } from '../shared/ansi.service';
import { Ansi2Html } from '../shared/ansi2html';

@Component({
  selector: 'app-mudclient',
  templateUrl: './mudclient.component.html',
  styleUrls: ['./mudclient.component.css']
})
export class MudclientComponent implements OnInit {

 
  @ViewChild('mudInput') mudInput: ElementRef;

  private mudc_id : string;
  private mudName : string = 'disconnect';
  private connected : boolean;
  private obs_connect;
  private obs_connected;
  private obs_data;
  private obs_debug;
  private ansiCurrent: Ansi2Html;
  private mudlines : Ansi2Html[] = [];
  public messages : MudMessage[] = [];
  public inpmessage : string;
  public lastdbg : DebugData;
  
  constructor(
    private socketService: SocketService,
    private ansiService:AnsiService) { 

    }

  private connect() {
    if (this.mudName.toLowerCase() == 'disconnect') {
      if (this.mudc_id) {
        if (this.obs_debug) this.obs_debug.unsubscribe();
        if (this.obs_data) this.obs_data.unsubscribe();
        if (this.obs_connect) this.obs_connect.unsubscribe();// including disconnect
        this.connected = false;
        this.mudc_id = undefined;
        return;
      }
    }
    const other = this;
    const mudOb = {mudname:this.mudName}; // TODO options???
    this.obs_connect = this.socketService.mudConnect(mudOb).subscribe(_id => {
      other.mudc_id = _id;
      other.obs_connected = this.socketService.mudConnectStatus(_id).subscribe(
          flag => {other.connected = flag;
        });
      other.obs_data = this.socketService.mudReceiveData(_id).subscribe(outline => {
          var outp = outline;
          const idx = outline.indexOf(other.ansiService.ESC_CLRSCR);
          if (idx >=0) {
            other.messages = [];
            other.mudlines = [];
          }
          const a2harr = this.ansiService.ansiTransform(outp,other.ansiCurrent);
          other.mudlines = other.mudlines.concat(a2harr);
          other.ansiCurrent = a2harr[a2harr.length-1];
          other.messages.push({text:outp});
        });
      other.obs_debug = this.socketService.mudReceiveDebug(_id).subscribe(debugdata => {
          other.lastdbg = debugdata;
        });
    });
  }

  ngOnInit() { 
    this.ansiCurrent = this.ansiService.getDefault();
  }

  ngOnDestroy() {
    this.obs_debug.unsubscribe();
    this.obs_data.unsubscribe();
    this.obs_connect.unsubscribe();// including disconnect
    this.obs_connected.unsubscribe(); 
  }

  sendMessage() {
    this.socketService.mudSendData(this.mudc_id,this.inpmessage);
    this.inpmessage = '';
  }

  onSelectMud(mudselection : string) {
    this.mudName = mudselection;
    this.connect();
  }

  @HostListener('click')
  public autofocusInput() {
    this.mudInput.nativeElement.focus();
  }


}
