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
import {TableModule} from 'primeng/table';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    FocusTrapModule,
    InputTextModule,
    CheckboxModule,
    ColorPickerModule,
    MenuModule,MenubarModule,
    DynamicDialogModule,
    DialogModule,TableModule,
    ToastModule
  ],
  providers: [
    DialogService,MessageService
  ],
  exports:[
    FocusTrapModule,
    InputTextModule,
    CheckboxModule,
    ColorPickerModule,
    MenuModule,MenubarModule,
    DynamicDialogModule,
    DialogModule,TableModule,
    ToastModule
  ]
})
export class PrimeModule { }
