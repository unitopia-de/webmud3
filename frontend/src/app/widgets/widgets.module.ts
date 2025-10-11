import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { ScrollPanel } from 'primeng/scrollpanel';

import { InventoryComponent } from './inventory/inventory.component';

@NgModule({
  declarations: [InventoryComponent],
  imports: [
    CommonModule,
    FormsModule,
    BrowserModule,
    BrowserAnimationsModule,
    ScrollPanel
  ],
  exports: [InventoryComponent],
})
export class WidgetsModule {}
