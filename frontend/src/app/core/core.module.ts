import { NgModule } from '@angular/core';
import { MenuModule } from './menu/menu.module';
import { MudModule } from './mud/mud.module';

@NgModule({
  imports: [MenuModule, MudModule],
  exports: [MenuModule, MudModule],
})
export class CoreModule {}
