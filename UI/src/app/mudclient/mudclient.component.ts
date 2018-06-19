import { Component, OnInit, ViewChild, ElementRef, HostListener } from '@angular/core';
import { SocketService } from '../shared/socket.service';
import { MudMessage } from '../shared/mud-message';
import { DebugData } from '../shared/debug-data';

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
  public messages : MudMessage[] = [];
  public inpmessage : string;
  public lastdbg : DebugData;
  
  constructor(private socketService: SocketService) { }

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
          other.messages.push({text:outline});
        });
      other.obs_debug = this.socketService.mudReceiveDebug(_id).subscribe(debugdata => {
          other.lastdbg = debugdata;
        });
    });
  }

  ngOnInit() { 
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
