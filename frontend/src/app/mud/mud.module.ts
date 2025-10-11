import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';

import { Divider } from 'primeng/divider';
import { Menubar } from 'primeng/menubar';

import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MudclientComponent } from './mudclient/mudclient.component';
import { MudmenuComponent } from './mudmenu/mudmenu.component';
import { MudspanComponent } from './mudspan/mudspan.component';
import { SettingsModule } from '../settings/settings.module';
import { WidgetsModule } from '../widgets/widgets.module';
import { DialogService } from 'primeng/dynamicdialog';

@NgModule({
  declarations: [MudclientComponent, MudmenuComponent, MudspanComponent],
  imports: [
    CommonModule,
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    Divider,
    Menubar,
    SettingsModule,
    WidgetsModule,
  ],
  providers: [DialogService],
  exports: [MudclientComponent],
})
export class MudModule {}
