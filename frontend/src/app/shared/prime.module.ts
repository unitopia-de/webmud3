import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FocusTrapModule } from 'primeng/focustrap';
import { AutoFocusModule } from 'primeng/autofocus';
import { InputTextModule } from 'primeng/inputtext';
import { DividerModule } from 'primeng/divider';
import { MenuModule } from 'primeng/menu';
import { MenubarModule } from 'primeng/menubar';
import { DialogModule } from 'primeng/dialog';
import { DynamicDialogModule } from 'primeng/dynamicdialog';
import { DialogService } from 'primeng/dynamicdialog';
import { CheckboxModule } from 'primeng/checkbox';
import { ColorPickerModule } from 'primeng/colorpicker';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ConfirmationService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { ToolbarModule } from 'primeng/toolbar';
import { ButtonModule } from 'primeng/button';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { DropdownModule } from 'primeng/dropdown';
import { SlideMenuModule } from 'primeng/slidemenu';
import { TabViewModule } from 'primeng/tabview';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ScrollPanelModule } from 'primeng/scrollpanel';

// Todo[myst]: Remove this whole module and import on the fly
@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    FocusTrapModule,
    AutoFocusModule,
    InputTextModule,
    DividerModule,
    CheckboxModule,
    ScrollPanelModule,
    ColorPickerModule,
    SlideMenuModule,
    MenuModule,
    MenubarModule,
    TabViewModule,
    InputTextareaModule,
    DynamicDialogModule,
    ConfirmPopupModule,
    DialogModule,
    TableModule,
    DropdownModule,
    ToastModule,
    ToolbarModule,
    ButtonModule,
  ],
  providers: [DialogService, MessageService, ConfirmationService],
  exports: [
    FocusTrapModule,
    AutoFocusModule,
    InputTextModule,
    DividerModule,
    CheckboxModule,
    ScrollPanelModule,
    ColorPickerModule,
    SlideMenuModule,
    MenuModule,
    MenubarModule,
    TabViewModule,
    InputTextareaModule,
    DynamicDialogModule,
    ConfirmPopupModule,
    DialogModule,
    TableModule,
    DropdownModule,
    ToastModule,
    ToolbarModule,
    ButtonModule,
  ],
})
export class PrimeModule {}
