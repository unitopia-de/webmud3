import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoginComponent } from './login/login.component';
import { UnitopiaComponent } from './unitopia/unitopia.component';
import { OrbitComponent } from './orbit/orbit.component';
import { MudModule } from '../mud/mud.module';
import { Uni1993Component } from './uni1993/uni1993.component';
import { EditorComponent } from './editor/editor.component';

@NgModule({
  imports: [
    MudModule,
    CommonModule
  ],
  declarations: [LoginComponent, UnitopiaComponent, OrbitComponent, Uni1993Component, EditorComponent],
  exports:[LoginComponent, UnitopiaComponent, OrbitComponent]
})
export class NonportalModule { }
