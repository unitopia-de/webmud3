import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { MudInputComponent } from './components/mud-input/mud-input.component';
import { MudOutputComponent } from './components/mud-output/mud-output.component';
import { MudspanComponent } from './components/mud-span/mud-span.component';
import { MudclientComponent } from './mud-client/mud-client.component';

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
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
  ],
  exports: [MudclientComponent],
})
export class MudModule {}
