import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { WidgetsModule } from '@mudlet3/frontend/features/widgets';
import { PrimeModule } from '@mudlet3/frontend/shared';

import { MenuModule } from '../menu/menu.module';
import { MudInputComponent } from './components/mud-input/mud-input.component';
import { MudOutputComponent } from './components/mud-output/mud-output.component';
import { MudspanComponent } from './components/mud-span/mud-span.component';
import { MudclientComponent } from './mud-client/mud-client.component';

import { SplitterModule } from 'primeng/splitter';

const primeModules = [SplitterModule];

@NgModule({
  declarations: [
    MudclientComponent,
    MudspanComponent,
    MudInputComponent,
    MudOutputComponent,
  ],
  imports: [
    CommonModule,
    BrowserModule,
    PrimeModule,
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    WidgetsModule,
    MenuModule,
    primeModules,
  ],
  exports: [MudclientComponent],
})
export class MudModule {}
