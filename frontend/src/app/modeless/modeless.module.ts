import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Button } from 'primeng/button';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { Menubar } from 'primeng/menubar';
import { TabsModule } from 'primeng/tabs';
// import { TabPanel } from 'primeng/tabview';
import { Toast } from 'primeng/toast';
import { Toolbar } from 'primeng/toolbar';


import { ResizableDraggableComponent } from './resizable-draggable/resizable-draggable.component';
import { FlexibleAreaComponent } from './flexible-area/flexible-area.component';
import { WindowComponent } from './window/window.component';
import { DirlistComponent } from './dirlist/dirlist.component';
import { EditorComponent } from './editor/editor.component';
import { KeypadComponent } from './keypad/keypad.component';
import { KeypadConfigComponent } from './keypad-config/keypad-config.component';
import { KeyoneComponent } from './keyone/keyone.component';
import { CharStatComponent } from './char-stat/char-stat.component';
import { ConfirmationService } from 'primeng/api';

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
  imports: [
    CommonModule, 
    FormsModule,
    Button,
    ConfirmPopupModule,
    DialogModule,
    Menubar,
    SelectModule,
    TabsModule,
    // TabPanel,
    Toolbar,
    Toast
  ],
  providers: [
    ConfirmationService
  ],
  exports: [
    ResizableDraggableComponent,
    FlexibleAreaComponent,
    WindowComponent,
  ],
})
export class ModelessModule {}
