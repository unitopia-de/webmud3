import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {MatTabsModule} from '@angular/material';
import { DeviceDetectorModule } from 'ngx-device-detector';
import { AngularDraggableModule } from 'angular2-draggable';

import { AppComponent } from './app.component';
import { ChatComponent } from './chat/chat.component';
import { SocketService } from './shared/socket.service';
import { LoggerService } from './shared/logger.service';
import { LogdisplayComponent } from './logdisplay/logdisplay.component';
import { AnsiService } from './mud/ansi.service';
import { TabviewComponent } from './tabview/tabview.component';
import { TabconDirective } from './tabcon.directive';
import { ConfigService } from './shared/config.service';
import { AppRoutingModule } from './app-routing.module';
import { NonportalModule } from './nonportal/nonportal.module';
import { MudModule } from './mud/mud.module';
import { NonPortalGuard } from './non-portal-guard';
import { PortalGuard } from './portal-guard';
import { WINDOW_PROVIDERS } from './shared/WINDOW_PROVIDERS';
import { ServerConfigService } from './shared/server-config.service';
import { WindowsService } from './nonmodal/windows.service';
import { NonmodalModule } from './nonmodal/nonmodal.module';
import { WindowComponent } from './nonmodal/window/window.component';
import { CommonModule } from '@angular/common';
import { MaterialModule } from './material.module';

@NgModule({
  declarations: [
    AppComponent,
    ChatComponent,
    LogdisplayComponent,
    TabviewComponent,
    TabconDirective,
    WindowComponent,
  ],
  imports: [
    BrowserModule,CommonModule,
    MaterialModule,
    BrowserAnimationsModule,MudModule,
    NonportalModule,
    FormsModule,
    NonmodalModule,
    AngularDraggableModule,
    DeviceDetectorModule.forRoot(),
    AppRoutingModule
  ],
  providers: [
    WINDOW_PROVIDERS,
    ServerConfigService,
    SocketService,WindowsService,
    NonPortalGuard,PortalGuard,
    LoggerService,
    ConfigService,
    AnsiService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
