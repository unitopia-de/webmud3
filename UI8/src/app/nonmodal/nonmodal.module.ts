import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AngularDraggableModule } from 'angular2-draggable';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { MyDynamicComponent } from './window/my-dynamic.component';
import { EditorComponent } from './editor/editor.component';
import { AceEditorModule } from 'ng2-ace-editor';
import { MaterialModule } from '../material.module';
import { DirlistComponent } from './dirlist/dirlist.component';
import { ConfigviewerComponent } from './configviewer/configviewer.component';

import { ColorPickerModule } from 'ngx-color-picker';

@NgModule({

  imports: [
    BrowserModule,FormsModule,AceEditorModule,
    CommonModule,AngularDraggableModule,MaterialModule,ColorPickerModule,
  ],
  declarations: [MyDynamicComponent, EditorComponent, DirlistComponent, ConfigviewerComponent],
  entryComponents: [EditorComponent,DirlistComponent, ConfigviewerComponent],
})
export class NonmodalModule { }
