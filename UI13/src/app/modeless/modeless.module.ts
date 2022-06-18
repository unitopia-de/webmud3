import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ResizableDraggableComponent } from './resizable-draggable/resizable-draggable.component';
import { FlexibleAreaComponent } from './flexible-area/flexible-area.component';
import { WindowComponent } from './window/window.component';
import { DirlistComponent } from './dirlist/dirlist.component';
import { PrimeModule } from '../prime.module';
import { EditorComponent } from './editor/editor.component';
import { KeypadComponent } from './keypad/keypad.component';
import { KeypadConfigComponent } from './keypad-config/keypad-config.component';
import { KeyoneComponent } from './keyone/keyone.component';

@NgModule({
  declarations: [
    ResizableDraggableComponent, 
    FlexibleAreaComponent, 
    WindowComponent, 
    DirlistComponent, 
    EditorComponent, KeypadComponent, KeypadConfigComponent, KeyoneComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    PrimeModule
  ],
  providers:[
  ],
  exports: [
    ResizableDraggableComponent, 
    FlexibleAreaComponent,WindowComponent
  ],
})
export class ModelessModule { }
