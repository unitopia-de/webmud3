import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import {MatButtonModule,MatCheckboxModule,MatToolbarModule,MatInputModule,MatTabsModule,
    MatProgressSpinnerModule,MatCardModule,MatMenuModule, MatIconModule,} from '@angular/material';


@NgModule({
  imports: [MatButtonModule, MatCheckboxModule,MatToolbarModule,MatInputModule,MatTabsModule,
    MatProgressSpinnerModule,MatCardModule,MatMenuModule,MatIconModule],
  exports: [MatButtonModule, MatCheckboxModule,MatToolbarModule,MatInputModule,MatTabsModule,
    MatProgressSpinnerModule,MatCardModule,MatMenuModule, MatIconModule]
})


export class MaterialModule{}