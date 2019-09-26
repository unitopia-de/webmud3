import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoginComponent } from './login/login.component';
import { UnitopiaComponent } from './unitopia/unitopia.component';
import { OrbitComponent } from './orbit/orbit.component';
import { MudModule } from '../mud/mud.module';

@NgModule({
  imports: [
    MudModule,
    CommonModule
  ],
  declarations: [LoginComponent, UnitopiaComponent, OrbitComponent],
  exports:[LoginComponent, UnitopiaComponent, OrbitComponent]
})
export class NonportalModule { }
