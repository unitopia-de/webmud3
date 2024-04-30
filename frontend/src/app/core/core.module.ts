import { NgModule } from '@angular/core';
import { MenuModule } from './menu/menu.module';

@NgModule({
  imports: [MenuModule],
  exports: [MenuModule],
})
export class CoreModule {}
