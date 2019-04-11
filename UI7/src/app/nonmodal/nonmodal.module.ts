import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AngularDraggableModule } from 'angular2-draggable';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { MyDynamicComponent } from './window/my-dynamic.component';

@NgModule({

  imports: [
    BrowserModule,FormsModule,
    CommonModule,AngularDraggableModule,
  ],
  declarations: [MyDynamicComponent]
})
export class NonmodalModule { }
