import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { PrimeModule } from '../prime.module';
import { InventoryComponent } from './inventory/inventory.component';



@NgModule({
  declarations: [
    InventoryComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    BrowserModule,
    BrowserAnimationsModule,
    PrimeModule
  ],
  exports: [
    InventoryComponent
    ]
})
export class WidgetsModule { }
