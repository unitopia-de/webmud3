import { Component, Input, Output, EventEmitter } from '@angular/core';
import { WindowConfig } from '../window-config';

@Component({
  selector: 'my-dynamic',
  template: `I am inserted dynamically! {{config.windowid}}`
})
export class MyDynamicComponent {
  public config :  WindowConfig;
  public lastInMsg : string = '';
  public lastOutMsg : string = '';
  public lastError : string = '';

  protected incommingMsg(msg : string) {

  }

  protected outgoingMsg(msg : string) {
    this.lastOutMsg = msg;
    this.outMsg.emit(msg);
  }
  
  @Input()
  set inMsg(inMsg: string) {
    this.lastInMsg = inMsg;
    this.incommingMsg(inMsg);
  }
  get inMsg(): string { return this.lastInMsg; }

  @Output() outMsg = new EventEmitter<string>();

  constructor() {

  }
  
}