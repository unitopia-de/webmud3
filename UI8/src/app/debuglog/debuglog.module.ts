import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViewlogComponent } from './viewlog/viewlog.component';
import { SearchlogComponent } from './searchlog/searchlog.component';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { MaterialModule } from '../material.module';



@NgModule({
  declarations: [ViewlogComponent, SearchlogComponent],
  imports: [
    CommonModule,BrowserModule,FormsModule,MaterialModule,
  ],
  exports: [ViewlogComponent,],
})
export class DebuglogModule { }
