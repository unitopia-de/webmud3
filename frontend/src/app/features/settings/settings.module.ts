import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { PrimeModule } from '@mudlet3/frontend/shared';
import { ColorSettingsComponent } from './color-settings/color-settings.component';
import { EditorSearchComponent } from './editor-search/editor-search.component';

@NgModule({
  declarations: [ColorSettingsComponent, EditorSearchComponent],
  imports: [CommonModule, BrowserModule, FormsModule, PrimeModule],
  exports: [ColorSettingsComponent, EditorSearchComponent],
})
export class SettingsModule {}
