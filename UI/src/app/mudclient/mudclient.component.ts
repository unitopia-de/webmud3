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
  private obs_connect;
  private obs_data;
  private obs_debug;
  public messages : MudMessage[] = [];
  public inpmessage : string;
  public lastdbg : DebugData;
  
  constructor(private socketService: SocketService) { }

  ngOnInit() {
    const mudOb = {mudname:'Orbit'}; // TODO options???
    this.obs_connect = this.socketService.mudConnect(mudOb).subscribe(_id => {
      this.mudc_id = _id;
      this.obs_data = this.socketService.mudReceiveData(_id).subscribe(outline => {
        this.messages.push({text:outline});
      });
      this.obs_debug = this.socketService.mudReceiveDebug(_id).subscribe(debugdata => {
        this.lastdbg = debugdata;
      });
    });
  }

  ngOnDestroy() {
    this.obs_debug.unsubscribe();
    this.obs_data.unsubscribe();
    this.obs_connect.unsubscribe();// including disconnect
  }

  sendMessage() {
    this.socketService.mudSendData(this.mudc_id,this.inpmessage);
    this.inpmessage = '';
  }

  @HostListener('click')
  public autofocusInput() {
    this.mudInput.nativeElement.focus();
  }


}
