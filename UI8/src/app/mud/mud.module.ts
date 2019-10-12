import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatMenuModule} from '@angular/material/menu';
import { MudlistComponent } from './mudlist/mudlist.component';
import { MudspanComponent } from './mudspan/mudspan.component';
import { MudclientComponent } from './mudclient/mudclient.component';
import { FormsModule } from '../../../node_modules/@angular/forms';
import { MudmenuComponent } from './mudmenu/mudmenu.component';
import { MatIconModule, MatTooltipModule } from '@angular/material';


@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    MatMenuModule,
    MatIconModule,
    MatTooltipModule
  ],
  declarations: [MudlistComponent,MudspanComponent,MudclientComponent, MudmenuComponent],
  exports: [MudlistComponent,MudspanComponent,MudclientComponent],
})
export class MudModule { }
