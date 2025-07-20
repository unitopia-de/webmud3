import { NgModule } from '@angular/core';

import { MudModule } from './mud/mud.module';

@NgModule({
  imports: [MudModule],
  exports: [MudModule],
})
export class CoreModule {}
