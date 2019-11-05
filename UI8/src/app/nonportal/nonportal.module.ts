import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoginComponent } from './login/login.component';
import { UnitopiaComponent } from './unitopia/unitopia.component';
import { OrbitComponent } from './orbit/orbit.component';
import { MudModule } from '../mud/mud.module';
import { Uni1993Component } from './uni1993/uni1993.component';
import { EditorTestComponent } from './editor/editor.component';
import { AceEditorModule } from 'ng2-ace-editor';
import { DebuglogComponent } from './debuglog/debuglog.component';
import { AuthModule } from '../auth/auth.module';
import { DebuglogModule } from '../debuglog/debuglog.module';

@NgModule({
  imports: [
    MudModule,AceEditorModule,
    CommonModule,AuthModule,DebuglogModule,
  ],
  declarations: [LoginComponent, UnitopiaComponent, OrbitComponent, Uni1993Component, EditorTestComponent, DebuglogComponent],
  exports:[LoginComponent, UnitopiaComponent, OrbitComponent]
})
export class NonportalModule { }
