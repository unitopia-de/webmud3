import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AutoFocusModule } from 'primeng/autofocus';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ColorPickerModule } from 'primeng/colorpicker';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { DialogModule } from 'primeng/dialog';
import { DividerModule } from 'primeng/divider';
import { DropdownModule } from 'primeng/dropdown';
import { DialogService, DynamicDialogModule } from 'primeng/dynamicdialog';
import { FocusTrapModule } from 'primeng/focustrap';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { MenuModule } from 'primeng/menu';
import { MenubarModule } from 'primeng/menubar';
import { ScrollPanelModule } from 'primeng/scrollpanel';
import { SlideMenuModule } from 'primeng/slidemenu';
import { TableModule } from 'primeng/table';
import { TabViewModule } from 'primeng/tabview';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';

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
