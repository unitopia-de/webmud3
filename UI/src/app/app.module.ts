import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { ChatComponent } from './chat/chat.component';
import { SocketService } from './shared/socket.service';
import { LoggerService } from './shared/logger.service';
import { LogdisplayComponent } from './logdisplay/logdisplay.component';
import { MudclientComponent } from './mudclient/mudclient.component';

@NgModule({
  declarations: [
    AppComponent,
    ChatComponent,
    LogdisplayComponent,
    MudclientComponent
  ],
  imports: [
    BrowserModule,
    FormsModule
  ],
  providers: [
    SocketService,
    LoggerService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
