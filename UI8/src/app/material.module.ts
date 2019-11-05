import { NgModule } from '@angular/core';

import {MatButtonModule,MatCheckboxModule,MatToolbarModule,MatInputModule,MatTabsModule,MatPaginatorModule,MatExpansionModule,
    MatSelectModule,MatOptionModule,MatProgressSpinnerModule,MatCardModule,MatMenuModule, MatIconModule,} from '@angular/material';


@NgModule({
  imports: [MatButtonModule, MatCheckboxModule,MatToolbarModule,MatInputModule,MatTabsModule,MatExpansionModule,
    MatSelectModule,MatOptionModule,MatProgressSpinnerModule,MatCardModule,MatMenuModule,MatPaginatorModule,MatIconModule],
  exports: [MatButtonModule, MatCheckboxModule,MatToolbarModule,MatInputModule,MatTabsModule,MatExpansionModule,
    MatSelectModule,MatOptionModule,MatProgressSpinnerModule,MatCardModule,MatMenuModule, MatPaginatorModule,MatIconModule]
})


export class MaterialModule{}