import { Component } from '@angular/core';
import { WindowConfig } from '../window-config';

@Component({
  selector: 'my-dynamic',
  template: `I am inserted dynamically! {{config.windowid}}`
})
export class MyDynamicComponent {
  public config :  WindowConfig;
}