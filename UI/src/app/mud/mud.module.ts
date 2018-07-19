import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MudlistComponent } from './mudlist/mudlist.component';
import { MudspanComponent } from './mudspan/mudspan.component';
import { MudclientComponent } from './mudclient/mudclient.component';
import { FormsModule } from '../../../node_modules/@angular/forms';

@NgModule({
  imports: [
    CommonModule,
    FormsModule
  ],
  declarations: [MudlistComponent,MudspanComponent,MudclientComponent],
  exports: [MudlistComponent,MudspanComponent,MudclientComponent],
})
export class MudModule { }
