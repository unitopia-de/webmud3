import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import { DeviceDetectorModule } from 'ngx-device-detector';
import { AngularDraggableModule } from 'angular2-draggable';

import { AppComponent } from './app.component';
import { ChatComponent } from './chat/chat.component';
import { SocketService } from './shared/socket.service';
import { AnsiService } from './mud/ansi.service';
import { TabviewComponent } from './tabview/tabview.component';
import { TabconDirective } from './tabcon.directive';
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
import { HttpClientModule } from '@angular/common/http';
import { LoggerModule, NgxLoggerLevel } from 'ngx-logger';

@NgModule({
  declarations: [
    AppComponent,
    ChatComponent,
    TabviewComponent,
    TabconDirective,
    WindowComponent,
  ],
  imports: [
    BrowserModule,CommonModule,
    MaterialModule,HttpClientModule,
    BrowserAnimationsModule,MudModule,
    NonportalModule,
    FormsModule,
    NonmodalModule,
    AngularDraggableModule,
    DeviceDetectorModule.forRoot(),
    LoggerModule.forRoot({
      level: NgxLoggerLevel.TRACE, 
      serverLogLevel: NgxLoggerLevel.TRACE,
      enableSourceMaps: true}),
    AppRoutingModule
  ],
  providers: [
    WINDOW_PROVIDERS,
    ServerConfigService,
    SocketService,WindowsService,
    NonPortalGuard,PortalGuard,
    AnsiService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
