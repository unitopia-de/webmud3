import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {NgxAutoScrollModule} from "ngx-auto-scroll";

import { AppComponent } from './app.component';
import { ChatComponent } from './chat/chat.component';
import { SocketService } from './shared/socket.service';
import { LoggerService } from './shared/logger.service';
import { LogdisplayComponent } from './logdisplay/logdisplay.component';
import { MudclientComponent } from './mudclient/mudclient.component';
import { MudlistComponent } from './mudlist/mudlist.component';
import { AnsiService } from './shared/ansi.service';
import { MudspanComponent } from './mudspan/mudspan.component';

@NgModule({
  declarations: [
    AppComponent,
    ChatComponent,
    LogdisplayComponent,
    MudclientComponent,
    MudlistComponent,
    MudspanComponent,
  ],
  imports: [
    BrowserModule,
    FormsModule,
    NgxAutoScrollModule
  ],
  providers: [
    SocketService,
    LoggerService,
    AnsiService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
