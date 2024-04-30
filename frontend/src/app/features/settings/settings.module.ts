import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { ColorSettingsComponent } from './color-settings/color-settings.component';
import { PrimeModule } from '@mudlet3/frontend/shared';

@NgModule({
  declarations: [ColorSettingsComponent],
  imports: [CommonModule, BrowserModule, FormsModule, PrimeModule],
  exports: [ColorSettingsComponent],
})
export class SettingsModule {}
