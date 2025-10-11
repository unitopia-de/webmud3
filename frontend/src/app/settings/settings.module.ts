import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';

import { Button } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ColorPicker } from 'primeng/colorpicker';
import { Menubar } from 'primeng/menubar';

import { ColorSettingsComponent } from './color-settings/color-settings.component';
import { EditorSearchComponent } from './editor-search/editor-search.component';

@NgModule({
  declarations: [ColorSettingsComponent, EditorSearchComponent],
  imports: [
    CommonModule, 
    BrowserModule, 
    FormsModule,
    Button,
    CheckboxModule,
    ColorPicker,
    Menubar],
  exports: [ColorSettingsComponent],
})
export class SettingsModule {}
