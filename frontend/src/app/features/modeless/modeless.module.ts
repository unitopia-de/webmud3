import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ResizableDraggableComponent } from './resizable-draggable/resizable-draggable.component';
import { FlexibleAreaComponent } from './flexible-area/flexible-area.component';
import { WindowComponent } from './window/window.component';
import { DirlistComponent } from './dirlist/dirlist.component';
import { EditorComponent } from './editor/editor.component';
import { KeypadComponent } from './keypad/keypad.component';
import { KeypadConfigComponent } from './keypad-config/keypad-config.component';
import { KeyoneComponent } from './keyone/keyone.component';
import { CharStatComponent } from './char-stat/char-stat.component';
import { PrimeModule } from '@mudlet3/frontend/shared';

@NgModule({
  declarations: [
    ResizableDraggableComponent,
    FlexibleAreaComponent,
    WindowComponent,
    DirlistComponent,
    EditorComponent,
    KeypadComponent,
    KeypadConfigComponent,
    KeyoneComponent,
    CharStatComponent,
  ],
  imports: [CommonModule, FormsModule, PrimeModule],
  providers: [],
  exports: [
    ResizableDraggableComponent,
    FlexibleAreaComponent,
    WindowComponent,
  ],
})
export class ModelessModule {}
