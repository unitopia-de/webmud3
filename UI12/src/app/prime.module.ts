import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {FocusTrapModule} from 'primeng/focustrap';
import {InputTextModule} from 'primeng/inputtext';
import {MenuModule} from 'primeng/menu';
import {MenubarModule} from 'primeng/menubar';
import {DialogModule} from 'primeng/dialog';
import {DynamicDialogModule} from 'primeng/dynamicdialog';
import {DialogService} from 'primeng/dynamicdialog';
import {CheckboxModule} from 'primeng/checkbox';
import {ColorPickerModule} from 'primeng/colorpicker';
import {ToastModule} from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {ConfirmationService} from 'primeng/api';
import {TableModule} from 'primeng/table';
import {ToolbarModule} from 'primeng/toolbar';
import {ButtonModule} from 'primeng/button';
import {ConfirmPopupModule} from 'primeng/confirmpopup';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    FocusTrapModule,
    InputTextModule,
    CheckboxModule,
    ColorPickerModule,
    MenuModule,MenubarModule,
    DynamicDialogModule,ConfirmPopupModule,
    DialogModule,TableModule,
    ToastModule,ToolbarModule,ButtonModule
  ],
  providers: [
    DialogService,MessageService,ConfirmationService
  ],
  exports:[
    FocusTrapModule,
    InputTextModule,
    CheckboxModule,
    ColorPickerModule,
    MenuModule,MenubarModule,
    DynamicDialogModule,ConfirmPopupModule,
    DialogModule,TableModule,
    ToastModule,ToolbarModule,
    ButtonModule
  ]
})
export class PrimeModule { }
