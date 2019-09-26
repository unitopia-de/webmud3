import { Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef } from '@angular/core';

import { MyMessage } from '../shared/my-message';
import { SocketService } from '../shared/socket.service';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
})
export class ChatComponent implements OnInit, OnDestroy {

  @ViewChild('chatInput', {static: false}) chatInput: ElementRef;

  public messages : MyMessage[] = [];
  public connection;
  public message : string;

  constructor(private socketService: SocketService) { }

  ngOnInit() {
    this.connection = this.socketService.getChatMessages().subscribe(message => {
      this.messages.push(message);
    })
  }

  ngOnDestroy() {
    this.connection.unsubscribe();
  }

  sendMessage() {
    this.socketService.sendChatMessage(this.message);
    this.message = '';
  }

  @HostListener('click')
  public autofocusInput() {
    this.chatInput.nativeElement.focus();
  }
}
